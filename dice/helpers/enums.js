// const OBJECT_TYPE = Object.freeze({
//     DIE: 'die',
//     DESK: 'desk',
//     BARRIER_LEFT: 'barrier_left', 
//     BARRIER_RIGHT: 'barrier_right', 
//     BARRIER_TOP: 'barrier_top', 
//     BARRIER_BOTTOM:'barrier_bottom'
// });

export default class OBJ_TYPE {
    static DIE              = new OBJ_TYPE(DIE           , 'die');
    static DESK             = new OBJ_TYPE(DESK          , 'desk');
    static BARRIER_LEFT     = new OBJ_TYPE(BARRIER_LEFT  , 'barrier_left'); 
    static BARRIER_RIGHT    = new OBJ_TYPE(BARRIER_RIGHT , 'barrier_right'); 
    static BARRIER_TOP      = new OBJ_TYPE(BARRIER_TOP   , 'barrier_top');
    static BARRIER_BOTTOM   = new OBJ_TYPE(BARRIER_BOTTOM, 'barrier_bottom');

    constructor(key, value) {
        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static asArray() {
        return [
            OBJ_TYPE.DIE           ,
            OBJ_TYPE.DESK          ,
            OBJ_TYPE.BARRIER_LEFT  ,
            OBJ_TYPE.BARRIER_RIGHT ,
            OBJ_TYPE.BARRIER_TOP   ,
            OBJ_TYPE.BARRIER_BOTTOM,
        ];
    }
}