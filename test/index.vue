<template>
  <div>123</div>
</template>

<script lang="ts">
import Vue from "vue";
import { mapState } from "./index.test";

const a = mapState("userInfo/test/test1", ["test1"]);
export default Vue.extend({
  computed: {
    ...mapState("userInfo/test/test1", ["test1"]),
    ...mapState("userInfo/test/test1/test21", ["test21"]),
    ...mapState("userInfo/test/test1/test2", ["test2"]),
  },
  created(this: Vue) {
    console.log(this.$$store.state.userInfo.test.test1.test21.test21);
    this.$$store.commit("userInfo/test/test1/setTest1", "123");
    this.$$store.state.userInfo.test.test1.test21.test21;
    this.$$store;
  },
});
</script>
