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
};
