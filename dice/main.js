"use strict";

function dice_initialize(container) {

    var canvas = $t.id('canvas');
    canvas.style.width = window.innerWidth - 1 + 'px';
    canvas.style.height = window.innerHeight - 1 + 'px';
    var set = $t.id('set');


    $t.bind(set, 'mousedown', function(ev) { ev.stopPropagation(); });
    $t.bind(set, 'mouseup', function(ev) { ev.stopPropagation(); });
    $t.bind(set, 'focus', function(ev) { $t.set(container, { class: '' }); });
    $t.bind(set, 'blur', function(ev) { $t.set(container, { class: 'noselect' }); });

    $t.bind($t.id('clear'), ['mouseup', 'touchend'], function(ev) {
        ev.stopPropagation();
        set.value = '0';
    });

    var params = $t.get_url_params();

    if (params.chromakey) {
        options.colors.desk = 0x00ff00;
        $t.id('control_panel').style.display = 'none';
    }
    if (params.shadows == 0) {
        $t.dice.use_shadows = false;
    }
    if (params.color == 'white') {
        options.colors.dice_body = '#808080';
        options.colors.dice_label = '#202020';
    }

    var box = new $t.dice.dice_box(canvas, { w: 500, h: 300 });

    $t.bind(window, 'resize', function() {
        canvas.style.width = window.innerWidth - 1 + 'px';
        canvas.style.height = window.innerHeight - 1 + 'px';
        box.reinit(canvas, { w: 500, h: 300 });
    });

    // function show_selector() {
    //     info_div.style.display = 'none';
    //     selector_div.style.display = 'inline-block';
    //     box.draw_selector();
    // }

    function before_roll(vectors, callback) {

        // do here rpc call or whatever to get your own result of throw.
        // then callback with array of your result, example:
        // callback([2, 2, 2, 2]); // for 4d6 where all dice values are 2.
        callback();
    }

    // function notation_getter() {
    //     return $t.dice.parse_notation(set.value);
    // }

    function after_roll(result) {
        if (params.chromakey || params.noresult) return;
        var res = result.join(' ');

        if (result.length > 1) res += ' = ' + 
                (result.reduce(function(s, a) { return s + a; }));

    }

    box.bind_mouse(container, before_roll, after_roll);
    $t.roll = function() {
        box.start_throw(before_roll, after_roll);
    }

    $t.bind(container, ['mouseup', 'touchend'], function(ev) {
        ev.stopPropagation();
        // if (selector_div.style.display == 'none') {
        //     if (!box.rolling) show_selector();
        //     box.rolling = false;
        //     return;
        // }
        var name = box.search_dice_by_mouse(ev);
        if (name != undefined) {

        }
    });

    // if (params.notation) {
    //     set.value = params.notation;
    // }
    // if (params.roll) {
        
        $t.roll();
    // }

}
