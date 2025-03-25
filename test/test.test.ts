import { ActionContext } from "vuex/types/index.js";
import { createTypedStore, Getter } from "../src/index";
import { createTypedStore as createTypedStoreDist } from "../dist";

interface IState {
  user: {
    yuzi: string;
  };
  car: {
    carId: string;
    nian: number
  }
}

const locationGetters = {
  getLocation: () => "location",
};

const debug = process.env.NODE_ENV !== "production";
const storeOptions = {
  modules: {
    location: {
      state: {
        location: "location",
      },
      getters: locationGetters,
      mutations: {
        setLocation: (state: any, payload: string) => {
          state.location = payload;
        },
        setLocation2: (state: any) => {
          state.location = "location2";
        },
        setLocation3: (state: any, payload?: string) => {
          state.location = payload;
        },
        setLocation4: (state: any, payload: boolean) => {
          state.location = payload;
        },
      },
      actions: {
        asyncAction: async (
          {
            state,
            getters,
          }: { state: any; getters: Getter<typeof locationGetters> },
          payload: number
        ) => {
          return new Promise<number>((resolve) => {
            setTimeout(() => {
              console.log(getters.getLocation);
              resolve(state.location + payload);
            }, 1000);
          });
        },
      },
    },
    userInfo: {
      state: {
        userInfo: "userInfo",
        phone: 123,
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
                setTest1: (state: any, payload: boolean) => {
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
                    setTest2: (state: any, payload: string) => {
                      state.test2 = payload;
                    },
                  },
                },
                test21: {
                  state: {
                    test21: "test21",
                  },
                  getters: {
                    getTest21: () => 123,
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
    car:{
      carId:'123',
      nian: 2025
    }
  } satisfies IState,
  getters: {
    getUser: (state: IState) => {
      return state.user.yuzi;
    },
  },
  mutations: {
    getUser1: (state: IState) => {
      console.log(state, "123");
    },
    setLocationInfo: (state: IState, payload: boolean) => {
      console.log(state, payload);
    },
  },
  actions:{
    setUser: async ({commit}:ActionContext<IState,IState>, user:{yuzi:string}) => {
      const res = await new Promise<undefined>((resolve,_rej)=>{
        setTimeout(resolve,1000)
      })
      return res
    }
  },
  strict: debug,
};

export const { store, mapState, mapGetters, mapMutations, mapActions } =
  createTypedStore(storeOptions);


// mapState 支持的四种写法
const mapStateExample1 = {...mapState(['car','user'])}
const mapStateExample2 = {...mapState('userInfo',['phone','userInfo'])}
const mapStateExample3 = {...mapState({
  alias1: (state) => state.user.yuzi,
  alias2: (state) => state.userInfo.test.test1.test2,
})}
const mapStateExample4 = {...mapState('userInfo/test',{
  alias1: (state) => state.test,
})}
// @ts-expect-error mapState不支持该种写法,未传命名空间，数组取值只能取根store上的store
const mapStateExample5 = {...mapState(['userInfo/userInfo2'])}

// mapGetters 支持的四种写法
const mapGettersExample1 = {...mapGetters(['userInfo/test/getTest','getUser'])}
const mapGettersExample2 = {...mapGetters('userInfo/test',['getTest'])}
const mapGettersExample3 = {...mapGetters({
  alias1: 'getUser',
  alias2: 'userInfo/test/getTest',
  alias3: 'userInfo/test/test1/test21/getTest21',
})}
const mapGettersExample4 = {...mapGetters('userInfo',{
  alias1: 'getUserInfo',
})}

// mapMutations 支持的四种写法
const mapMutationsExample1 = {...mapMutations(['getUser1','userInfo/test/test1/setTest1'])}
const mapMutationsExample2 = {...mapMutations('userInfo/test/test1',['setTest1'])}
const mapMutationsExample3 = {...mapMutations({
  alias1:'getUser1', 
  alias2:'userInfo/test/test1/setTest1'
})}
const mapMutationsExample4 = {...mapMutations('userInfo/test/test1',{alias1:'setTest1'})}

// mapActions 支持的四种次恶法
const mapActionsExample1 = {...mapActions(['setUser','location/asyncAction'])}
const mapActionsExample2 = {...mapActions('location',['asyncAction'])}
const mapActionsExample3 = {...mapActions({
  alias1:'setUser',
  alias2:'location/asyncAction'
})}
const mapActionsExample4 = {...mapActions('location',{alias1:'asyncAction'})}

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false
type Expect<T extends true> = T

const dispatchTest1 = store.dispatch('setUser',{yuzi: 'string'})
const dispatchTest2 = store.dispatch('location/asyncAction', 123)

const commitTest1 = store.commit('location/setLocation','string')
const commitTest2 = store.commit('location/setLocation4',true)
const commitTest3 = store.commit('location/setLocation2')

type cases = [
  Expect<Equal<typeof store.state.car, {carId:string,nian:number}>>,
  Expect<Equal<typeof store.state.location.location, string>>,
  Expect<Equal<typeof store.getters.getUser, string>>,
  Expect<Equal<typeof store.getters['userInfo/test/test1/test21/getTest21'], number>>,
  Expect<Equal<typeof dispatchTest1, Promise<undefined>>>,
  Expect<Equal<typeof dispatchTest2, Promise<number>>>,
  Expect<Equal<typeof commitTest1, void>>,
  Expect<Equal<typeof commitTest2, void>>,
  Expect<Equal<typeof commitTest3, void>>,
]

/** 测试通过tsc打包后的类型推断与打包前的是否一致 */
const { store:storeDist, mapState:mapStateDist, mapGetters:mapGettersDist, mapMutations:mapMutationsDist, mapActions:mapActionsDist } = createTypedStoreDist(storeOptions);
storeDist.state.userInfo.test.test1.test21.test21;

const mapStateDistExample1 = {...mapStateDist(['car','user'])}
const mapStateDistExample2 = {...mapStateDist('userInfo',['phone','userInfo'])}
const mapStateDistExample3 = {...mapStateDist({
  alias1: (state) => state.user.yuzi,
  alias2: (state) => state.userInfo.test.test1.test2,
})}
const mapStateDistExample4 = {...mapStateDist('userInfo/test',{
  alias1: (state) => state.test,
})}

type mapStateCases = [
  Expect<Equal<typeof mapStateDistExample1, typeof mapStateExample1>>,
  Expect<Equal<typeof mapStateDistExample2, typeof mapStateExample2>>,
  Expect<Equal<typeof mapStateDistExample3, typeof mapStateExample3>>,
  Expect<Equal<typeof mapStateDistExample4, typeof mapStateExample4>>,
]

const mapGettersDistExample1 = {...mapGettersDist(['userInfo/test/getTest','getUser'])}
const mapGettersDistExample2 = {...mapGettersDist('userInfo/test',['getTest'])}
const mapGettersDistExample3 = {...mapGettersDist({
  alias1: 'getUser',
  alias2: 'userInfo/test/getTest',
  alias3: 'userInfo/test/test1/test21/getTest21',
})}
const mapGettersDistExample4 = {...mapGettersDist('userInfo',{
  alias1: 'getUserInfo',
})}

type mapGettersCases = [
  Expect<Equal<typeof mapGettersDistExample1, typeof mapGettersExample1>>,
  Expect<Equal<typeof mapGettersDistExample2, typeof mapGettersExample2>>,
  Expect<Equal<typeof mapGettersDistExample3, typeof mapGettersExample3>>,
  Expect<Equal<typeof mapGettersDistExample4, typeof mapGettersExample4>>,
]

const mapMutationsDistExample1 = {...mapMutationsDist(['getUser1','userInfo/test/test1/setTest1'])}
const mapMutationsDistExample2 = {...mapMutationsDist('userInfo/test/test1',['setTest1'])}
const mapMutationsDistExample3 = {...mapMutationsDist({
  alias1:'getUser1', 
  alias2:'userInfo/test/test1/setTest1'
})}
const mapMutationsDistExample4 = {...mapMutationsDist('userInfo/test/test1',{alias1:'setTest1'})}

type mapMutationsCases = [
  Expect<Equal<typeof mapMutationsDistExample1, typeof mapMutationsExample1>>,
  Expect<Equal<typeof mapMutationsDistExample2, typeof mapMutationsExample2>>,
  Expect<Equal<typeof mapMutationsDistExample3, typeof mapMutationsExample3>>,
  Expect<Equal<typeof mapMutationsDistExample4, typeof mapMutationsExample4>>,
]

const mapActionsDistExample1 = {...mapActionsDist(['setUser','location/asyncAction'])}
const mapActionsDistExample2 = {...mapActionsDist('location',['asyncAction'])}
const mapActionsDistExample3 = {...mapActionsDist({
  alias1:'setUser',
  alias2:'location/asyncAction'
})}
const mapActionsDistExample4 = {...mapActionsDist('location',{alias1:'asyncAction'})}

type mapActionsCases = [
  Expect<Equal<typeof mapActionsDistExample1, typeof mapActionsExample1>>,
  Expect<Equal<typeof mapActionsDistExample2, typeof mapActionsExample2>>,
  Expect<Equal<typeof mapActionsDistExample3, typeof mapActionsExample3>>,
  Expect<Equal<typeof mapActionsDistExample4, typeof mapActionsExample4>>,
]
