import serial
import adafruit_fingerprint

uart = serial.Serial("/dev/serial0", baudrate=57600, timeout=1)

finger = adafruit_fingerprint.Adafruit_Fingerprint(uart)

print("Fingerprint sensor test")

if finger.verify_password():
    print("Sensor detected successfully!")
else:
    print("Sensor not detected")
