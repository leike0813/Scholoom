import hashlib
import json
import os
import pathlib
import re
import sys
import tomllib
import urllib.parse


def reject(message):
    raise ValueError(message)


def load(path):
    with open(path, "rb") as file:
        data = file.read(1048577)
    if len(data) > 1048576:
        reject("TOML exceeds 1 MiB")
    return tomllib.loads(data.decode("utf-8"))


def check_workspace(root):
    # uv discovers parent workspaces even with --no-config and an explicit --project.
    for parent in root.parents:
        declaration = parent / "pyproject.toml"
        if declaration.exists() and "workspace" in load(declaration).get("tool", {}).get("uv", {}):
            reject("Parent uv workspace is outside the authorized project declarations")


def url(value):
    parsed = urllib.parse.urlsplit(value)
    if (
        parsed.scheme not in ("https", "http")
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or len(value) > 1024
    ):
        reject("Credential-bearing or unsupported locked URL")
    return value


def inspect():
    project = load(sys.argv[1])
    lock = load(sys.argv[2])
    root = pathlib.Path(sys.argv[1]).parent.resolve()
    check_workspace(root)
    if lock.get("version") != 1:
        reject("Unsupported uv.lock version")
    metadata = project.get("project", {})
    if "dependencies" in metadata.get("dynamic", []):
        reject("Dynamic dependencies require unsupported build code")
    packages = lock.get("package", [])
    if not isinstance(packages, list) or len(packages) > 1001:
        reject("Locked package count exceeds limit")
    result = []
    network = set()
    roots = 0
    for package in packages:
        name = package.get("name")
        version = package.get("version")
        source = package.get("source", {})
        if (
            not isinstance(name, str)
            or not name
            or not isinstance(version, str)
            or not version
            or len(name) > 1024
            or len(version) > 1024
        ):
            reject("Invalid locked package identity")
        if name == re.sub(r"[-_.]+", "-", metadata.get("name", "")).lower() and source in (
            {"virtual": "."},
            {"editable": "."},
        ):
            roots += 1
            continue
        if set(source) == {"registry"}:
            origin = url(source["registry"])
            network.add(origin)
            local = None
        elif set(source) == {"path"}:
            relative = pathlib.Path(source["path"])
            local = (root / relative).resolve()
            if (
                relative.is_absolute()
                or ".." in relative.parts
                or not local.is_relative_to(root)
                or local.suffix != ".whl"
            ):
                reject(name + ": only project-local wheel paths are supported")
            origin = relative.as_posix()
        else:
            reject(name + ": unsupported locked source (git/editable/directory/build)")
        wheels = package.get("wheels", [])
        if not isinstance(wheels, list) or not wheels or len(wheels) > 1000:
            reject(name + ": no supported locked wheels; source builds are disabled")
        records = []
        for wheel in wheels:
            digest = wheel.get("hash", "")
            if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
                reject(name + ": wheel requires a locked SHA-256 hash")
            if local is None:
                location = url(wheel.get("url", ""))
                if not urllib.parse.unquote(
                    urllib.parse.urlsplit(location).path
                ).endswith(".whl"):
                    reject(name + ": locked artifact is not a wheel")
                network.add(location)
            else:
                if len(wheels) != 1 or wheel.get("filename") != local.name:
                    reject(name + ": local wheel identity does not match lock")
                if local.stat().st_size > 67108864:
                    reject(name + ": local wheel exceeds 64 MiB")
                with local.open("rb") as file:
                    actual = "sha256:" + hashlib.file_digest(file, "sha256").hexdigest()
                if actual != digest:
                    reject(name + ": local wheel hash differs from lock")
                location = origin
            records.append({"source": location, "hash": digest})
        result.append(
            {"name": name, "version": version, "source": origin, "wheels": records}
        )
    if roots != 1:
        reject("Lock must contain exactly the declared project root")
    if len(network) > 100:
        reject("Locked network source count exceeds 100")
    return {
        "pythonVersion": ".".join(map(str, sys.version_info[:3])),
        "dependencies": result,
        "network": sorted(network),
    }


if sys.argv[1] == "--sync":
    try:
        check_workspace(pathlib.Path(sys.argv[3]).resolve())
    except (ValueError, OSError, TypeError, AttributeError) as error:
        print("Environment workspace check failed: " + str(error)[:512], file=sys.stderr)
        sys.exit(1)
    os.execv(sys.argv[2], [sys.argv[2], *sys.argv[4:]])

try:
    result = inspect()
except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
    message = (
        str(error)
        if type(error) is ValueError
        else "Cannot inspect locked declarations: " + type(error).__name__
    )
    result = {"error": {"code": "unavailable", "message": message[:512]}}
text = json.dumps(result, ensure_ascii=False)
if len(text.encode()) > 1048576:
    text = json.dumps(
        {"error": {"code": "tooLarge", "message": "Locked evidence exceeds 1 MiB"}}
    )
pathlib.Path(sys.argv[3]).write_text(text, encoding="utf-8")
