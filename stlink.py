import usb
import struct
import time

def p32(v): return struct.pack("<L", v)
def p16(v): return struct.pack("<H", v)

class STLINK(object):
    def __init__(self, dev):
        self.dev = dev
        self.dev.set_configuration(1)

    def send_recv(self, data, reply_len=None, timeout=3000):
        self.dev.write(2, data, timeout)
        if reply_len: return self.dev.read(0x81, reply_len, timeout)

    def get_current_mode(self): return self.send_recv("\xf5", 2)

    def get_version(self): return self.send_recv("\xf1", 7)

    def get_target_voltage(self):
        buf = self.send_recv("\xf7", 8)
        factor = (buf[3] << 24) | (buf[2] << 16) | (buf[1] << 8) | (buf[0] << 0)
        reading = (buf[7] << 24) | (buf[6] << 16) | (buf[5] << 8) | (buf[4] << 0)
        return 2.4 * float(reading) / float(factor)

    def dfu_exit(self): self.send_recv("\xf3\x07")

    def dbg_cmd(self, cmd, reply_len=None):
        self.dev.write(2, "\xf2" + cmd)
        if reply_len: return self.dev.read(0x81, reply_len)

    def dbg_enter(self): self.dbg_cmd("\x20\xa3")

    def dbg_exit(self): self.dbg_cmd("\x21")

    def dbg_get_status(self): return self.dbg_cmd("\x01", 2)

    def dbg_force_debug(self): return self.dbg_cmd("\x02", 2)

    def dbg_resetsys(self): return self.dbg_cmd("\x03", 2)

    def dbg_runcore(self): return self.dbg_cmd("\x09", 2)

    def dbg_readallregs(self): return self.dbg_cmd("\x3a", 88)
    
    def dbg_readcoreid(self):
        buf = self.dbg_cmd("\x22", 4)
        return (buf[3] << 24) | (buf[2] << 16) | (buf[1] << 8) | (buf[0] << 0)

    def dbg_write_debug32(self, addr, data):
        res = self.dbg_cmd("\x35" + p32(addr) + p32(data), 2)
        return res

    def dbg_read_debug32(self, addr):
        buf = self.dbg_cmd("\x36" + p32(addr), 8)
        wat =  (buf[3] << 24) | (buf[2] << 16) | (buf[1] << 8) | (buf[0] << 0)
        return (buf[7] << 24) | (buf[6] << 16) | (buf[5] << 8) | (buf[4] << 0)

    def dbg_read_mem32(self, addr):
        buf = self.dbg_cmd("\x07" + p32(addr) + p32(4), 4)
        return (buf[3] << 24) | (buf[2] << 16) | (buf[1] << 8) | (buf[0] << 0)

    def dbg_write_mem32(self, addr, value):
        self.dbg_cmd("\x08" + p32(addr) + p16(4))
        self.send_recv(p32(value))
