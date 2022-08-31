import { $t } from "../../teal.js";

export class SettingsRenderer {
    div = $t.id("settings");

    add(prop, name, bind) {
        $t.element("label", {id: `label${name}`}, this.div, name + ":");
        let elem = $t.element("input", {id: `elem_${name}`, type: "number", value: prop }, this.div);
        $t.bind(elem, "change", function(ev) {
            bind(Number.parseFloat(elem.value));
        });
        $t.element("br", null, this.div);
    }

    addVector(prop, name, bind) {
        $t.element("label", {id: `label${name}`}, this.div, name + ":");
        $t.element("br", null, this.div);
            
        $t.element("label", {id: `label_x_${name}`}, this.div, "x: ");
        let x = $t.element("input", {id: `x_${name}`, type: "number", value: prop.x }, this.div);

        $t.element("br", null, this.div);

        $t.element("label", {id: `label_y_${name}`}, this.div, "y: ");
        let y = $t.element("input", {id: `y_${name}`, type: "number", value: prop.y }, this.div);

        $t.element("br", null, this.div);
        
        $t.element("label", {id: `label_z_${name}`}, this.div, "z: ");
        let z = $t.element("input", {id: `z_${name}`, type: "number", value: prop.z }, this.div);

        [x, y, z].forEach(elem => {
            $t.bind(elem, "change", function(ev) {
                let vector = new THREE.Vector3(
                    Number.parseFloat(x.value),
                    Number.parseFloat(y.value),
                    Number.parseFloat(z.value)
                );
                bind(vector);
            });
        })

        $t.element("br", null, this.div);
        $t.element("br", null, this.div);
    }
}
