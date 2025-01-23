import { Store } from "vuex/types/index.js";
import { createTypedStore } from "../src/index";
import { createTypedStore as createTypedStore2 } from "../dist";

const debug = process.env.NODE_ENV !== "production";
const storeOptions = {
  modules: {
    location: {
      state: {
        location: "location",
      },
      getters: {
        getLocation: () => "location",
      },
      mutations: {
        setLocation: (state: any, payload: string) => {
          state.location = payload;
        },
        setLocation2: (state: any) => {
          state.location = "location2";
        },
      },
      actions: {
        asyncAction: async (state: any, payload: any) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(state.location + payload);
            }, 1000);
          });
        },
      },
    },
    userInfo: {
      state: {
        userInfo: "userInfo",
        userInfo2: "userInfo2",
      },
      getters: {
        getUserInfo: () => "userInfo",
      },
      modules: {
        test: {
          state: () => ({
            test: "test",
          }),
          getters: {
            getTest: () => "test",
          },
          modules: {
            test1: {
              state: {
                test1: "test1",
              },
              getters: {
                getTest1: () => "test1",
              },
              mutations: {
                setTest1: (state: any, payload: any) => {
                  state.test1 = payload;
                },
              },
              modules: {
                test2: {
                  state: {
                    test2: "test2",
                  },
                  getters: {
                    getTest2: () => "test2",
                  },
                  mutations: {
                    setTest2: (state: any, payload: any) => {
                      state.test2 = payload;
                    },
                  },
                },
                test21: {
                  state: {
                    test21: "test21",
                  },
                  getters: {
                    getTest21: () => "test21",
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  state: {
    user: {
      yuzi: "yuzer",
    },
  },
  getters: {
    getUser: (state: any) => {
      return state.user.yuzi as string;
    },
  },
  mutations: {
    getUser1: (state: any) => {
      console.log(state, "123");
    },
    setLocationInfo: (state: any, payload: boolean) => {
      console.log(state, payload);
    },
  },
  strict: debug,
};

export const { store, mapState, mapGetters, mapMutations, mapActions } =
  createTypedStore(storeOptions);

const a = mapState("userInfo/test/test1", ["test1"]);
store;
const b = mapGetters("userInfo/test/test1", ["getTest1"]);

const c = mapState(["userInfo/userInfo2"]);
const d = mapState(["userInfo/test/test"]);
store.state.userInfo.test.test;
const e = mapState(["user"]);
store.state.user;
const f = mapState({ userInfo2: (state) => state.user.yuzi });
const g = mapState({ userInfo2: (state) => state.userInfo.userInfo2 });
const h = mapState("userInfo/test/test1", { test1: (state) => state.test1 });

const i = mapGetters("userInfo/test/test1", ["getTest1"]);
const j = mapGetters("userInfo/test/test1", { getTest1: "getTest1" });
// @ts-expect-error
const m = mapGetters("getLocation", ["getLocation"]);
const k = mapGetters(["userInfo/test/test1/getTest1"]);
const l = mapGetters({ getTest123: "userInfo/test/test1/getTest1" });
store.state.userInfo.test.test1.test21.test21;

const store2 = createTypedStore2(storeOptions);
store2.store.state.userInfo.test.test1.test21.test21;
store2.store;

const commit = store.commit;
commit("location/setLocation2");
// @ts-expect-error
commit("location/setLocation2", "location2");
commit("location/setLocation", "location2");
// @ts-expect-error
commit("location/setLocation");

const o = mapMutations("location", ["setLocation"]);
o.setLocation("location2");
const p = mapMutations("location", { setLocation: "setLocation" });
p.setLocation("location2");
const q = mapMutations("location", ["setLocation2"]);
q.setLocation2();

// 将改造过后的 Store 类型声明到 vue 的原型上，这样就可以在.vue 文件中获得 IDE 的智能提示了
declare module "vue/types/vue" {
  interface Vue {
    $$store: typeof store;
  }
}
