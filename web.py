from flask import Flask, request
import json
import usb
from stlink import STLINK

try:
    dev = usb.core.find(idVendor=0x0483,idProduct=0x3748)
    dev.reset()
    stlink = STLINK(dev)
    stlink.dfu_exit()
    stlink.dbg_enter()
except:
    stlink = None
    pass

app = Flask(__name__, static_url_path='/static')

@app.route("/")
def index(): return app.send_static_file("index.html")

@app.route("/svd.xml")
def svd_xml(): return app.send_static_file("EFM32HG309F64.svd")

@app.route("/api/mem/read32", methods=["POST"])
def mem_read32():
    address = request.get_json()["address"]
    if stlink:
        word = stlink.dbg_read_mem32(address)
        print "Reading 0x%x -> 0x%x" % (address, word)
        return json.dumps({"result": "ok", "address": address, "word": word})
    else:
        return json.dumps({"result": "fail", "address": address, "word": 0x00000000})

@app.route("/api/mem/write32", methods=["POST"])
def mem_write32():
    data = request.get_json()
    address = data["address"]
    word = data["word"]
    if stlink:
        print "Writing 0x%x -> 0x%x" % (address, word)
        stlink.dbg_write_mem32(address, word)
        return json.dumps({"result":"ok"})
    else:
        return json.dumps({"result":"fail"})

if __name__ == "__main__": app.run()
