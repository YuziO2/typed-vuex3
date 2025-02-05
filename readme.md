# typed-vuex3

为 Vuex 3.x 提供完整的 TypeScript 类型支持。

## 特性

- 完整的类型推导支持
- 支持嵌套模块的类型推导
- 支持 mapState、mapGetters、mapMutations、mapActions 的类型推导
- 与原生 Vuex 3.x API 完全兼容
- 支持命名空间模块

## 安装
```bash
npm install typed-vuex3
```

## 使用方法

### 1. 创建 Store

```typescript
import { createTypedStore } from 'typed-vuex3'

const storeOptions = {
  state: {
    count: 0
  },
  mutations: {
    increment(state) {
      state.count++
    }
  },
  modules: {
    user: {
      namespaced: true,
      state: {
        name: 'John'
      },
      mutations: {
        setName(state, name: string) {
          state.name = name
        }
      }
    }
  }
}

export const { store, mapState, mapGetters, mapMutations, mapActions } = createTypedStore(storeOptions)

// 声明 $$store 类型，避免与 Vuex 原生的 $store 类型冲突
declare module "vue/types/vue" {
  interface Vue {
    $$store: typeof store
  }
}
```

### 2. 在Store中使用

本项目也提供了Commit和Dispatch工具类，可以在store中进行类型标注。 
以`@store/modules/userInfo.ts`为例

```typescript
import type { Commit } from 'typed-vuex3'
const userInfoState = (): UserInfoState => ({
  userInfo: {
    userName: '',
    companyName: '',
    userMobile: '',
    roleName: '',
    autoApproved: false,
  },
  btnPermissions: [],
  menuPermissions: [],
  initialized: false,
})

const mutations = {
  setUserInfo(state: UserInfoState, payload: UserInfo) {
    state.initialized = true
    state.userInfo = { ...payload }
  },
}

const actions = {
  async getUserInfo(
    { commit, state }: { commit: Commit<typeof mutations>; // 使用Commit<typeof mutations>对commit获得类型标注
      state: UserInfoState },
    { router }: { router: Router }
  ) {
    let userInfoRes = null
    try {
      userInfoRes = await getUserInfo()
    } catch (e) {
      return
    }
    commit('setUserInfo', userInfoRes.data) //commit: <"setUserInfo">(type: "setUserInfo", payload: UserInfo) => void
  }
}
```
#### mutation/action里使用其它mutation/action的情况
有一些store的写法，会在其mutation/action的函数定义中使用commit/dispatch函数调用同级的其它commit/dispatch函数，对于这种情况，直接用`{ commit: Commit<typeof mutations> }`来标注commit/dispatch函数会造成循环引用的问题。我们的建议是根据依赖层级对mutation/action进行拆分。例如：
```js
const actions = {
  action1({state, commit}, payload){ // 没有使用其它的action
    console.log(payload)
  },
  action2({state, commit, dispatch}){ //使用了其它的action
    dispatch('action1', 1234)
  }
}
export default {
  namespaced: true,
  actions
}
```
改造后：
```ts
import type { Commit, Dispatch } from 'typed-vuex3'

const actions1 = {
  action1({ state, commit }: { state: State; commit: Commit<typeof mutations> }, payload: any){ // 没有使用其它的action
    console.log(payload)
  },
}
const actions2 = {
  action2({ state, commit, dispatch }: 
    { state: State; commit: Commit<typeof mutations>; dispatch: Dispatch<typeof actions1> }){ // 把用到的actions隔开，在这里的泛型就传用到的那一组actions（此处为actions1）
    dispatch('action1', 1234)
  }
}
export default {
  namespaced: true,
  actions: {
    ...actions1,
    ...actions2
  } // 这里要进行一个合并
}
```

#### root: true的情况
Vuex的namespace提供了一种在命名空间中直接访问全局store的方法：在创建mutations和actions时，第二个参数加入rootXXX，第三个参数传入`{root: true}`，详见[文档链接](https://vuex.vuejs.org/zh/guide/modules.html#%E5%9C%A8%E5%B8%A6%E5%91%BD%E5%90%8D%E7%A9%BA%E9%97%B4%E7%9A%84%E6%A8%A1%E5%9D%97%E5%86%85%E8%AE%BF%E9%97%AE%E5%85%A8%E5%B1%80%E5%86%85%E5%AE%B9%EF%BC%88global-assets%EF%BC%89)。
对于这种极为灵活的情况，我们的泛型系统会难以处理【主要是会有类型循环引用的问题】，无法进行这样的commit和dispatch函数进行类型提示。所以对使用根的情况，我们可以将使用`{root: true}`改成`import store from '@/store'`，然后使用这个store来代替【实际上，效果也完全相同】，这样我们就可以继续获得完整的类型提示。示例：

改造前：
```js
actions: {
  // 在这个模块中， dispatch 和 commit 也被局部化了
  // 他们可以接受 `root` 属性以访问根 dispatch 或 commit
  someAction ({ commit, getters, rootGetters }) {
    getters.someGetter // -> 'foo/someGetter'
    rootGetters.someGetter // -> 'someGetter'
    rootGetters['bar/someGetter'] // -> 'bar/someGetter'

    commit('someMutation') // -> 'foo/someMutation'
    commit('someMutation', null, { root: true }) // -> 'someMutation'
  }
}
```
改造后：
```ts
import type { Commit, Getter } from 'typed-vuex3'
import store from '@/store'
......
actions: {
  someAction ({ commit, getters }: {
    commit: Commit<typeof mutations>;
    getters: Getter<typeof getter>;
  }) {
    const rootGetters = store.getters
    getters.someGetter // -> 'foo/someGetter'
    rootGetters.someGetter // -> 'someGetter'
    rootGetters['bar/someGetter'] // -> 'bar/someGetter'

    commit('someMutation') // -> 'foo/someMutation'
    store.commit('someMutation') // -> 'someMutation'
  },
}
```

### 3. 在组件中使用

因为有了完善的类型推断，所以对源代码只需作很小的改动即可获得完整的类型
```typescript
import Vue from 'vue'
import { mapState, mapMutations } from '@/store' // 从vuex改成@/store

export default Vue.extend({
  computed: {
    // 支持命名空间模块
    ...mapState('user', ['name']),
    // 支持根模块
    ...mapState(['count'])
  },
  methods: {
    ...mapMutations('user', ['setName']),
    ...mapMutations(['increment'])
  },
  created() {
    // 完整的类型提示
    console.log(this.$$store.state.user.name)
    this.$$store.commit('user/setName', 'Jane') // $store改为$$store
  }
})
```

## 为什么使用 $$store

为了避免与 Vuex 原生的 `$store` 类型定义冲突，同时提供更完整的类型推导支持，我们使用 `$$store` 作为增强类型的 store 访问方式。这不会影响原有的 `$store` 的使用。

## 类型推导示例

```typescript
// State 类型推导
store.state.user.name // string
store.state.count // number

// Getters 类型推导
store.getters['user/getName'] // string

// Mutations 类型推导
store.commit('user/setName', 'Jane') // 参数类型检查
store.commit('increment') // 无参数检查

// Actions 类型推导
store.dispatch('user/fetchName') // 返回值类型推导
```

## 注意事项

1. 需要使用 TypeScript 4.0 或更高版本
2. 需要在 tsconfig.json 中启用 `strict` 模式
3. 与 Vuex 3.x 版本兼容，不支持 Vuex 4.x