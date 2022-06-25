const rndGen = {
  random_storage: [],

  use_true_random: false,

  rnd: function () {
    function getTrueRandom(thisObj) {
      if (!thisObj.use_true_random) return null;

      if (!thisObj.random_storage.length) {
        try {
          $t.rpc({ method: "random", n: 512 }, function (random_responce) {
            if (!random_responce.error)
              random_storage = random_responce.result.random.data;
            else thisObj.use_true_random = false;
          });
        } catch (e) {
            thisObj.use_true_random = false;
        }
      }

      return thisObj.use_true_random ? thisObj.random_storage.pop() : null;
    }

    return getTrueRandom(this) ?? Math.random();
  },

  
  make_random_vector: function(vector) {
    var random_angle = this.rnd() * Math.PI / 5 - Math.PI / 5 / 2;
    var vec = {
        x: vector.x * Math.cos(random_angle) - vector.y * Math.sin(random_angle),
        y: vector.x * Math.sin(random_angle) + vector.y * Math.cos(random_angle)
    };
    if (vec.x == 0) vec.x = 0.01;
    if (vec.y == 0) vec.y = 0.01;
    return vec;
  }
};
