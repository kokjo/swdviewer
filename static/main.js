function mem_read32(address, callback){
    $.jpost("/api/mem/read32", {"address": address})
        .then(function(data){
            callback(data["word"]);
        });
}

function mem_write32(address, word){
    $.jpost("/api/mem/write32", {"address": address, "word":word})
}

function hex(value){
    return "0x" + value.toString(16);
}

$.extend({
    jpost: function(url, body) {
        return $.ajax({
            type: 'POST',
            url: url,
            data: JSON.stringify(body),
            contentType: "application/json",
            dataType: 'json'
        });
    }
});

$.extend({
    each_reversed : function(list, callback){
        var list = list.toArray();
        keys = Object.keys(list).reverse();
        for(var i = 0; i < keys.length; i++)
            callback(keys[i], list[keys[i]]);
    }
});

class Field {
    constructor(register, xml){
        this.xml = $(xml);
        this.register = register;
        this.name = this.xml.find("> name").text();
        this.width = parseInt(this.xml.find("> bitWidth").text());
        this.offset = parseInt(this.xml.find("> bitOffset").text());
        this.mask = ((1 << this.width) - 1) << this.offset;
    }

    html(){
        return $("<div>").addClass("col").append(
            $("<div>").addClass("field-name").text(this.name),
            this.input
        );
    }

    register_updated(value){
        this.update_field((value & this.mask) >> this.offset);
    }

    update_field(fvalue){
        console.log("please implement", this);
    }

    update_register(fvalue){
        var value = this.register.value;
        value &= ~this.mask;
        value |= (fvalue << this.offset) & this.mask;
        this.register.update_value(value);
    }
}

class InputField extends Field {
    constructor(register, xml) {
        super(register, xml);
        this.input = $("<input>")
            .addClass("form-control field-value")
            .change(this.handle_input_change.bind(this));
    }
    handle_input_change(ev) {
        this.update_register(parseInt(this.input.val()));
    }
    update_field(fvalue){
        this.input.val(hex(fvalue));
    }
}

class SelectField extends Field {
    constructor (register, xml) {
        super(register, xml);
        this.enumvalues = this.xml.find("> enumeratedValues > enumeratedValue");
        this.input = $("<select>") 
            .addClass("form-control field-value")
            .change(this.handle_input_change.bind(this));
        $.each(this.enumvalues, (function(i, xml){
            var enumval = $(xml);
            var name = enumval.find("> name").text();
            var value = parseInt(enumval.find("> value").text());
            this.input.append(
                $("<option>").text(name).attr("value", value)
            );
        }).bind(this));
    }
    handle_input_change(ev) {
        this.update_register(parseInt(this.input.val()));
    }
    update_field(fvalue){
        this.input.val(fvalue);
    }
}

class CheckboxField extends Field {
    constructor (register, xml) {
        super(register, xml);
        this.input = $("<input>")
            .addClass("form-check-input field-value")
            .attr("type", "checkbox")
            .change(this.handle_input_change.bind(this));
    }
    handle_input_change(ev) {
        if(this.input.prop("checked")) {
            this.update_register(1);
        } else {
            this.update_register(0);
        }
    }
    update_field(fvalue) {
        this.input.prop('checked', fvalue);
    }
}

function make_field(register, xml){
    if($(xml).find("> enumeratedValues").length > 0){
        return new SelectField(register, xml);
    }
/*
    if($(xml).find("> bitWidth").text() == "1"){
        return new CheckboxField(register, xml);
    }
*/
    return new InputField(register, xml);
}

class Register {
    constructor(peripheral, xml){
        this.peripheral = peripheral;
        this.xml = $(xml);
        this.value = 0;
        this.name = this.xml.find("> name").text();
        this.offset = parseInt(this.xml.find("> addressOffset").text())
        this.address = this.peripheral.baseaddress + this.offset;
        this.input = $("<input>")
            .addClass("form-control form-control-sm register-value")
            .change(this.handle_input_change.bind(this));
        this.fields = this.xml.find("> fields > field").map((function(i, field){
            return make_field(this, field);
        }).bind(this));
    }

    handle_input_change(ev) {
        this.update_value(parseInt(this.input.val()));
    }

    update_value(value) {
        this.value = value;
        this.input.val(hex(this.value))
        this.fields.each(function(i, field){
            field.register_updated(value);
        });
    }

    read() {
        mem_read32(this.address, this.update_value.bind(this));
    }

    write() {
        mem_write32(this.address, this.value);
    }

    html() {
        this.read();

        var card = $("<div>").addClass("card register"); 
        
        card.append(
            $("<div>").addClass("card-header").append(
                $("<div>").addClass("row").append(
                    $("<div>").addClass("col float-left register-name").text(this.name),
                    $("<div>").addClass("col float-right").append(
                        this.input
                    ),
                    $("<div>").addClass("col float-right").append(
                        $("<button>")
                            .addClass("btn btn-primary")
                            .text("Read")
                            .click(this.read.bind(this))
                    ),
                    $("<div>").addClass("col float-right").append(
                        $("<button>")
                            .addClass("btn btn-danger")
                            .text("Write")
                            .click(this.write.bind(this))
                    )
                )
            )
        );

        var body = $("<div>").addClass("card-body row");
        
        $.each_reversed(this.fields, function(i, field){
            body.append(field.html());
        });

        card.append(body);

        return card;
    }
    
}

class Peripheral {
    constructor(xml) {
        this.xml = $(xml);
        this.name = this.xml.find("> name").text();
        this.baseaddress = parseInt(this.xml.find("> baseAddress").text());
        this.description = this.xml.find("> description").text();
    }
    show () {
        $(".register").remove();
        this.xml.find("> registers > register").each((function(i, xml) {
            $("#registers").append(
                new Register(this, xml).html()
            );
        }).bind(this));
    }
}

class PeripheralList {
    constructor(xml) {
        this.xml = $(xml);
        this.peripherals = this.xml.find("> device > peripherals > peripheral").map(function (i, xml) {
            return new Peripheral(xml)
        });
    }
    show() {
        $.each(this.peripherals, function(i, peripheral){
            $("#peripherals").append(
                $("<li class=\"nav-item\">")
                .append(
                    $("<a>")
                    .addClass("nav-link peripheral")
                    .text(peripheral.name)
                    .click(function () {
                        $(".peripheral").removeClass("active");
                        $(this).addClass("active");
                        peripheral.show()
                    })
                )
            );
        });
    }
};

$(function (){
    $.get("/svd.xml", function(xml) {
        new PeripheralList($.parseXML(xml)).show();
    });
});
