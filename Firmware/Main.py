import board
import busio
from kmk.kmk_keyboard import KMKKeyboard
from kmk.scanners.keypad import MatrixScanner
from kmk.scanners import DiodeOrientation
from kmk.keys import KC
from kmk.modules.encoder import EncoderHandler
from kmk.extensions.media_keys import MediaKeys
from kmk.modules.macros import Macros, Press, Release, Tap
from kmk.extensions.display import Display, TextEntry, ImageEntry

# For SSD1306
from kmk.extensions.display.ssd1306 import SSD1306



# Pin definitions
COL0 = board.D0
COL1 = board.D1
COL2 = board.D2
ROW0 = board.D9
ROW1 = board.D8
ROW2 = board.D7
ROW3 = board.D3
SDA = board.D4
SCL = board.D5
SW1A = board.D10
SW1B = board.D6

# Initialize KMK keyboard instance
keyboard = KMKKeyboard()
keyboard.extensions.append(MediaKeys())

macros = Macros()
keyboard.modules.append(macros)




i2c_bus = busio.I2C(SCL, SDA)
display_driver = SSD1306(
    i2c=i2c_bus,
    # Optional device_addres argument. Default is 0x3C.
    # device_address=0x3C,
)



display = Display(
    display=display_driver,
    entries=[
    TextEntry(text='flamebamboo', x=30, y=15),


 
],

    # Optional width argument. Default is 128.
    # width=128,
    height=32,
    dim_time=10,
    dim_target=0.2,
    off_time=1200,
    brightness=1,
)

keyboard.extensions.append(display)



#Macros

DELETE_GAPS = KC.MACRO(
    Press(KC.LGUI),
    Tap(KC.G),
    Release(KC.LGUI)
)

RAZOR = KC.MACRO(
    Press(KC.LGUI),
    Tap(KC.B),
    Release(KC.LGUI)

)


UNDO = KC.MACRO(
    Press(KC.LGUI),
    Tap(KC.Z),
    Release(KC.LGUI)

)


REDO = KC.MACRO(
    Press(KC.LGUI),    
    Press(KC.LSFT),    
    Tap(KC.Z),        
    Release(KC.LSFT), 
    Release(KC.LGUI)   
)

IMPORT_MEDIA =  KC.MACRO(
    Press(KC.LGUI),      
    Tap(KC.I),        
    Release(KC.LGUI)   
)

TRIM_END = KC.MACRO(
    Press(KC.LGUI),
    Press(KC.LSHIFT),
    Tap(KC.RBRACKET),
    Release(KC.LGUI),
    Release(KC.LSHIFT)
)

TRIM_START = KC.MACRO(
    Press(KC.LGUI),
    Press(KC.LSHIFT),
    Tap(KC.LBRACKET),
    Release(KC.LGUI),
    Release(KC.LSHIFT)
)
 





# Define row and column pins
ROW_PINS = [ROW0, ROW1, ROW2, ROW3]
COL_PINS = [COL0, COL1, COL2]

# Create and register the matrix scanner ONLY
keyboard.matrix = MatrixScanner(
    column_pins=COL_PINS,
    row_pins=ROW_PINS,
    columns_to_anodes=DiodeOrientation.COL2ROW,
    interval=0.02,
    max_events=64
)

# Configure encoder module (NOT scanner)
encoder_handler = EncoderHandler()
encoder_handler.pins = ((SW1A, SW1B, None),)  # No button pin
encoder_handler.map = [((KC.VOLU, KC.VOLD, KC.NO),)]  # Volume up, down, no button

# Add encoder to modules
keyboard.modules.append(encoder_handler)


# Keymap for 12 matrix keys only
keyboard.keymap = [
    [
        KC.MUTE, UNDO, REDO,    # Matrix keys [0-11]
        DELETE_GAPS,KC.SPACE , RAZOR,
        KC.N6,TRIM_START, TRIM_END,
        KC.N9, IMPORT_MEDIA, KC.BSPACE
    ]
]

# Start KMK
if __name__ == '__main__':
    keyboard.go()
