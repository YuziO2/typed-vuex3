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

### 2. 在组件中使用

```typescript
import Vue from 'vue'
import { mapState, mapMutations } from './store'

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
    this.$$store.commit('user/setName', 'Jane')
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