"""Regenerate original test assets with fontTools (optional developer dependency).
The test font contains a rectangular A glyph, making canvas verification unambiguous.
"""
from pathlib import Path
import struct
import zlib
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

assets = Path(__file__).parent / 'assets' / 'assets'
font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder(['.notdef', 'space', 'A'])
font.setupCharacterMap({32: 'space', 65: 'A'})
glyphs = {}
for name in ['.notdef', 'space', 'A']:
    pen = TTGlyphPen(None)
    if name == 'A':
        pen.moveTo((0, 0))
        pen.lineTo((800, 0))
        pen.lineTo((800, 800))
        pen.lineTo((0, 800))
        pen.closePath()
    glyphs[name] = pen.glyph()
font.setupGlyf(glyphs)
font.setupHorizontalMetrics({name: (1000, 0) for name in glyphs})
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({'familyName': 'MCPKitFixture', 'styleName': 'Regular',
                    'uniqueFontIdentifier': 'MCPKitFixture-Regular', 'fullName': 'MCPKitFixture Regular',
                    'psName': 'MCPKitFixture-Regular'})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
font.setupPost()
font.setupMaxp()
font.font['head'].created = font.font['head'].modified = 0
font.save(assets / 'fixture.ttf')

def chunk(kind, payload):
    return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
# A solid white RGB square. Ink's default theme renders this as bright green.
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 2, 2, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(b'\x00' + b'\xff' * 6 + b'\x00' + b'\xff' * 6)) + chunk(b'IEND', b'')
(assets / 'sample.png').write_bytes(png)
