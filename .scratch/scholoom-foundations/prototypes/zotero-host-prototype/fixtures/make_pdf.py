"""Create a synthetic two-page PDF with an outline; no real research data."""
from pathlib import Path
import sys

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

writer = PdfWriter()
font = writer._add_object(DictionaryObject({
    NameObject("/Type"): NameObject("/Font"),
    NameObject("/Subtype"): NameObject("/Type1"),
    NameObject("/BaseFont"): NameObject("/Helvetica"),
}))
for title in ("Scholoom prototype: Introduction", "Scholoom prototype: Methods"):
    page = writer.add_blank_page(width=612, height=792)
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
    })
    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 20 Tf 72 700 Td ({title}) Tj ET".encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(stream)
writer.add_outline_item("Introduction", 0)
writer.add_outline_item("Methods", 1)
with Path(sys.argv[1]).open("wb") as output:
    writer.write(output)
