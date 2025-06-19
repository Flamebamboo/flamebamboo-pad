import board
from kmk.kmk_keyboard import KMKKeyboard
from kmk.scanners.matrix import MatrixScanner
from kmk.keys import KC
from kmk.modules.macros import Press, Release, Tap, Macros
from kmk.modules.encoder import EncoderHandler



COL0 = board.GP26;
COL1 = board.GP27;
COL2 = board.GP28;
ROW0 = board.GP4;
ROW1 = board.GP2;
ROW2 = board.GP1;
ROW3 = board.GP29;
SDA = board.GP6;
SCL = board.GP7;
SW1A = board.GP3;
SW1B = board.GP0;

# Initialize KMK keyboard instance
keyboard = KMKKeyboard()

# Add macro module
macros = Macros()
keyboard.modules.append(macros)




# rotary encoder volume control
encoder_handler = EncoderHandler()
keyboard.modules.append(encoder_handler)
encoder_handler.pins = ((SW1A, SW1B),)
encoder_handler.map = [((KC.VOLU, KC.VOLD),)]

# Define row and column pins
ROW_PINS = [ROW0, ROW1, ROW2, ROW3]
COL_PINS = [COL0, COL1, COL2]

keyboard.matrix = MatrixScanner(
    columns=COL_PINS,
    rows=ROW_PINS,
)

# Keymap for 11 keys (3x4 matrix with one missing key)
# I will customise later for my needs probably video editing shortcuts
keyboard.keymap = [
    [
        KC.MUTE, KC.N1, KC.N2,
        KC.N3, KC.N4, KC.N5,
        KC.N6, KC.N7, KC.N8,
        KC.N9, KC.N0, KC.NO
    ]
]

# Start KMK
if __name__ == '__main__':
    keyboard.go()