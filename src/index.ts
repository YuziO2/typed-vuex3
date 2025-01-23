import Vue from "vue";
import Vuex from "vuex";
import type {
  Store,
  StoreOptions as VuexStoreOptions,
} from "vuex/types/index.js";

Vue.use(Vuex);

export type Commit<T extends { [key: string]: (...args: any[]) => any }> = <
  K extends keyof T
>(
  type: K,
  ...args: [Parameters<T[K]>[1]] extends [undefined]
    ? []
    : [Parameters<T[K]>[1]]
) => ReturnType<T[K]>; // 供commit函数使用

export type Dispatch<T extends { [key: string]: (...args: any[]) => any }> =
  Commit<T>; // 供dispatch函数使用

export function createTypedStore<S, StoreOptions extends VuexStoreOptions<S>>(
  storeOptions: StoreOptions
) {
  // 基础 ModuleMap
  type BaseModuleMap = {
    [K in keyof StoreOptions["modules"]]: StoreOptions["modules"][K];
  };
  type GetRootProp<
    K,
    Keys = "state" | "getters" | "actions" | "mutations"
  > = K extends Keys
    ? K extends keyof StoreOptions
      ? StoreOptions[K]
      : {}
    : {};

  // 【伪】递归模块映射，TODO：如何改成递归实现呢？
  // 例如：
  // type ExampleStore = {
  //   user: {
  //     state: { name: string }
  //     modules: {
  //       profile: {
  //         state: { age: number }
  //         modules: {
  //           settings: {
  //             state: { theme: string }
  //           }
  //         }
  //       }
  //     }
  //   }
  //   auth: {
  //     state: { loggedIn: boolean }
  //   }
  // }
  // 输出：
  // {
  //   user: { state: { name: string }, modules: { ... } },
  //   auth: { state: { loggedIn: boolean } },
  //   "user/profile": { state: { age: number }, modules: { ... } },
  //   "user/profile/settings": { state: { theme: string } }
  // }
  type ModulesPath = FlatUnionArr<
    ExtractModulesPaths<BaseModuleMap, keyof BaseModuleMap>
  >;
  type ModulesKey = {
    [K in ModulesPath as Join<Split<RemoveSlash<K>, "modules">, "/">]: Shift<
      Split<K, "/">
    >;
  };
  // 最终的 ModuleMap
  type ModuleMap = {
    // @ts-expect-error
    [K in keyof ModulesKey]: Get<BaseModuleMap, ModulesKey[K]>;
  };

  // 提取模块的指定类型
  type ExtractModuleState<T, K extends string> = T extends {
    [key in K]: infer S;
  }
    ? S extends (...args: any[]) => any
      ? ReturnType<S>
      : S
    : never;

  // 提取嵌套模块的指定类型
  type ExtractNestedModules<
    T,
    U extends string,
    Depth extends number[] = []
  > = Depth["length"] extends 5
    ? {}
    : T extends {
        modules: infer M;
      }
    ? {
        [K in keyof M]: ExtractModuleState<M[K], U> &
          ExtractNestedModules<M[K], U, [...Depth, 1]>;
      }
    : {};

  // 处理 store 的 state 类型
  type NestedState = {
    [K in keyof BaseModuleMap]: ExtractModuleState<BaseModuleMap[K], "state"> &
      ExtractNestedModules<BaseModuleMap[K], "state">;
  } & GetRootProp<"state">;
  type MappedState = {
    [K in keyof ModuleMap as "state" extends keyof ModuleMap[K]
      ? K
      : // @ts-expect-error
        never]: ModuleMap[K]["state"] extends (...args: any[]) => any
      ? // @ts-expect-error
        ReturnType<ModuleMap[K]["state"]>
      : // @ts-expect-error
        ModuleMap[K]["state"];
  } & GetRootProp<"state">;

  type FlattedState = FlatModuleProperty<"state"> & GetRootProp<"state">;

  // 将一个对象的 key 添加前缀，为 namespace 的store进行转换
  type AddKeyPrefix<T, P extends string> = {
    [K in keyof T as `${P}${string & K}`]: T[K];
  };
  // 辅助类型：将联合类型转为交叉类型
  // 例如：
  // 输入：'a' | 'b' | 'c'
  // 过程：
  // 1. Union 被分发到 (k: U) => void 中：
  //    (k: 'a') => void | (k: 'b') => void | (k: 'c') => void
  // 2. TypeScript 在函数参数位置会将联合类型转换为交叉类型：
  //    (k: 'a' & 'b' & 'c') => void
  // 3. 通过 infer I 提取参数类型：
  //    'a' & 'b' & 'c'
  type UnionToIntersection<U> = (
    U extends any ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never;
  // 将模块的指定属性展平并添加命名空间前缀
  // 例如：对于以下 ModuleMap
  // {
  //   userInfo: {
  //     mutations: {
  //       setUserInfo: (state, payload) => void
  //     }
  //   },
  //   location: {
  //     mutations: {
  //       setLocation: (state, payload) => void
  //     }
  //   }
  // }
  // 转换步骤：
  // 1. 遍历 ModuleMap 的每个键（userInfo, location）
  // 2. 对每个模块，检查是否有指定的属性（如 mutations）
  // 3. 如果有，使用 AddKeyPrefix 添加命名空间前缀
  // 4. 最后通过 UnionToIntersection 将所有结果合并
  // 转换后：
  // {
  //   'userInfo/setUserInfo': (state, payload) => void,
  //   'location/setLocation': (state, payload) => void
  // }
  type FlatModuleProperty<K extends string = "getters"> = UnionToIntersection<
    {
      [M in keyof ModuleMap]: ModuleMap[M] extends { [key in K]: infer S }
        ? S extends (...args: any[]) => infer R
          ? AddKeyPrefix<R, `${M & string}/`> // 如果是函数，处理其返回值
          : AddKeyPrefix<S, `${M & string}/`> // 如果是对象，直接处理
        : {};
    }[keyof ModuleMap]
  >;

  // 将 getter 函数转换成 {getterName: getterFuncsReturnType} 的对象类型
  type ReturnGetters<T extends { [key: string]: (...args: any) => any }> = {
    [P in keyof T]: ReturnType<T[P]>;
  };

  // 提取所有 module 的 getter 函数类型对象
  type MappedGetters = {
    [K in keyof ModuleMap as "getters" extends keyof ModuleMap[K]
      ? K
      : never]: ModuleMap[K] extends {
      [key in "getters"]: { [key: string]: (...args: any) => any };
    }
      ? ReturnGetters<ModuleMap[K]["getters"]>
      : never;
    // @ts-expect-error
  } & ReturnGetters<GetRootProp<"getters">>;
  // @ts-expect-error
  type FlattedGetters = ReturnGetters<FlatModuleProperty<"getters">> &
    // @ts-expect-error
    ReturnGetters<GetRootProp<"getters">>;

  // 处理 store 的 mutations 类型
  // 将 mutation 函数名及 payload 类型转换成 commit 函数的两个入参类型
  type FlattedCommit = FlatModuleProperty<"mutations"> &
    GetRootProp<"mutations">; // 无命名空间时使用
  type MappedCommit = {
    [K in keyof ModuleMap as "mutations" extends keyof ModuleMap[K]
      ? K
      : never]: ModuleMap[K] extends {
      [key in "mutations"]: { [key: string]: (...args: any[]) => any };
    }
      ? ModuleMap[K]["mutations"]
      : never;
  } & GetRootProp<"mutations">;

  type FlattedDispatch = FlatModuleProperty<"actions"> & GetRootProp<"actions">; // 无命名空间时使用
  type MappedDispatch = {
    [K in keyof ModuleMap as "actions" extends keyof ModuleMap[K]
      ? K
      : never]: ModuleMap[K] extends {
      [key in "actions"]: { [key: string]: (...args: any[]) => any };
    }
      ? ModuleMap[K]["actions"]
      : never;
  } & GetRootProp<"actions">;

  const store = new Vuex.Store(storeOptions);

  // mapState 函数重载声明
  function mapState<
    M extends Exclude<keyof MappedState, keyof GetRootProp<"state">>, // 去掉根模块，它的键不能作为命名空间，根store有getter、mutation、action时，同理也要去掉其map函数声明中有命名空间时的取值
    K extends keyof MappedState[M]
  >(namespace: M, map: K[]): { [Key in K]: () => MappedState[M][Key] }; // 有命名空间，map是数组
  function mapState<K extends keyof FlattedState>(
    map: K[]
  ): { [Key in K]: () => FlattedState[K] }; // 没有命名空间，map是数组，state应该是FlattedState
  function mapState<T extends { [key: string]: (state: NestedState) => any }>(
    map: T
  ): { [Key in keyof T]: () => ReturnType<T[Key]> }; // 没有命名空间，map是对象，state应该是NestedState
  function mapState<
    M extends Exclude<keyof MappedState, keyof GetRootProp<"state">>, // 去掉根模块，它的键不能作为命名空间
    T extends { [key: string]: (state: MappedState[M]) => any }
  >(namespace: M, map: T): { [Key in keyof T]: () => ReturnType<T[Key]> }; // 有命名空间，map是对象

  // mapState 函数实现
  function mapState(...args: any[]): any {
    // @ts-ignore
    return Vuex.mapState(...args);
  }

  // mapGetters 函数重载声明
  function mapGetters<
    M extends Exclude<keyof MappedGetters, keyof GetRootProp<"getters">>,
    K extends keyof MappedGetters[M]
  >(namespace: M, map: K[]): { [Key in K]: () => MappedGetters[M][Key] }; // 有命名空间，map是数组
  function mapGetters<K extends keyof FlattedGetters>(
    map: K[]
  ): { [Key in K]: () => FlattedGetters[K] }; // 没有命名空间，map是数组
  function mapGetters<T extends { [key: string]: keyof FlattedGetters }>(
    map: T
  ): { [Key in keyof T]: () => FlattedGetters[T[Key]] }; // 没有命名空间，map是对象
  function mapGetters<
    M extends Exclude<keyof MappedGetters, keyof GetRootProp<"getters">>,
    T extends { [key: string]: keyof MappedGetters[M] }
  >(namespace: M, map: T): { [Key in keyof T]: () => MappedGetters[M][T[Key]] }; // 有命名空间，map是对象

  // mapGetters 函数实现
  function mapGetters(...args: any[]): any {
    // @ts-ignore
    return Vuex.mapGetters(...args);
  }

  type ConditionalPayloadFunction<P, R> = [P] extends [undefined]
    ? () => R
    : (payload: P) => R;

  // mapMutations 函数重载声明
  function mapMutations<K extends keyof FlattedCommit>(
    map: K[]
  ): {
    [Key in K]: ConditionalPayloadFunction<
      // @ts-expect-error
      Parameters<FlattedCommit[Key]>[1],
      // @ts-expect-error
      ReturnType<FlattedCommit[Key]>
    >;
  }; // 没有命名空间，map是数组
  function mapMutations<T extends { [key: string]: keyof FlattedCommit }>(
    map: T
  ): {
    [Key in keyof T]: ConditionalPayloadFunction<
      // @ts-expect-error
      Parameters<FlattedCommit[T[Key]]>[1],
      // @ts-expect-error
      ReturnType<FlattedCommit[T[Key]]>
    >;
  }; // 没有命名空间，map是对象
  function mapMutations<
    M extends Exclude<keyof MappedCommit, keyof GetRootProp<"mutations">>,
    K extends keyof MappedCommit[M]
  >(
    namespace: M,
    map: K[]
  ): {
    [Key in K]: MappedCommit[M][Key] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<
          Parameters<MappedCommit[M][Key]>[1],
          ReturnType<MappedCommit[M][Key]>
        >
      : never;
  }; // 有命名空间，map是数组
  function mapMutations<
    M extends Exclude<keyof MappedCommit, keyof GetRootProp<"mutations">>,
    T extends { [key: string]: keyof MappedCommit[M] }
  >(
    namespace: M,
    map: T
  ): {
    [Key in keyof T]: MappedCommit[M][T[Key]] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<
          Parameters<MappedCommit[M][T[Key]]>[1],
          ReturnType<MappedCommit[M][T[Key]]>
        >
      : never;
  }; // 有命名空间，map是对象

  // mapMutations 函数实现
  function mapMutations(...args: any[]): any {
    // @ts-ignore
    return Vuex.mapMutations(...args);
  }

  // mapActions 函数重载声明
  function mapActions<K extends keyof FlattedDispatch>(
    map: K[]
  ): {
    [Key in K]: ConditionalPayloadFunction<
      // @ts-expect-error
      Parameters<FlattedDispatch[Key]>[1],
      // @ts-expect-error
      ReturnType<FlattedDispatch[Key]>
    >;
  }; // 没有命名空间，map是数组
  function mapActions<T extends { [key: string]: keyof FlattedDispatch }>(
    map: T
  ): {
    [Key in keyof T]: ConditionalPayloadFunction<
      // @ts-expect-error
      Parameters<FlattedDispatch[T[Key]]>[1],
      // @ts-expect-error
      ReturnType<FlattedDispatch[T[Key]]>
    >;
  }; // 没有命名空间，map是对象
  function mapActions<
    M extends Exclude<keyof MappedDispatch, keyof GetRootProp<"actions">>,
    K extends keyof MappedDispatch[M]
  >(
    namespace: M,
    map: K[]
  ): {
    [Key in K]: MappedDispatch[M][Key] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<
          Parameters<MappedDispatch[M][Key]>[1],
          ReturnType<MappedDispatch[M][Key]>
        >
      : never;
  }; // 有命名空间，map是数组
  function mapActions<
    M extends Exclude<keyof MappedDispatch, keyof GetRootProp<"actions">>,
    T extends { [key: string]: keyof MappedDispatch[M] }
  >(
    namespace: M,
    map: T
  ): {
    [Key in keyof T]: MappedDispatch[M][T[Key]] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<
          Parameters<MappedDispatch[M][T[Key]]>[1],
          ReturnType<MappedDispatch[M][T[Key]]>
        >
      : never;
  }; // 有命名空间，map是对象

  // mapActions 函数实现
  function mapActions(...args: any[]): any {
    // @ts-ignore
    return Vuex.mapActions(...args);
  }

  return {
    store: store as unknown as Omit<
      Store<StoreOptions>,
      "state" | "getters" | "commit" | "dispatch"
    > & {
      state: NestedState;
      getters: FlattedGetters;
      // @ts-expect-error
      commit: Commit<FlattedCommit>;
      // @ts-expect-error
      dispatch: Dispatch<FlattedDispatch>;
    },
    mapState,
    mapGetters,
    mapMutations,
    mapActions,
  };
}

type ExtractModulesPaths<
  T,
  K extends keyof T,
  P extends string = "",
  res extends string[] = []
> = K extends string
  ? T[K] extends { modules: infer M }
    ? ExtractModulesPaths<
        M,
        keyof M,
        `${P}/${K}/modules`,
        [...res, `${P}/${K}/`]
      >
    : [...res, `${P}/${K}/`]
  : never;
type Split<
  S extends string,
  strSplit extends string = "",
  arr extends string[] = []
> = S extends `${infer F}${strSplit}${infer E}`
  ? Split<E, strSplit, [...arr, F]>
  : S extends string
  ? S extends ""
    ? arr
    : [...arr, S]
  : arr;
type Join<
  arr extends string[],
  strJoin extends string = "",
  str extends string = ""
> = arr extends [infer F, ...infer E]
  ? arr[0] extends string
    ? F extends arr[0]
      ? E extends string[]
        ? Join<E, strJoin, `${str}${str extends "" ? "" : strJoin}${F}`>
        : str
      : str
    : str
  : str;
type Get<
  T = { k: { b: string } },
  Arr = ["a", "b", "c"],
  res = any
> = Arr extends [infer F, ...infer R]
  ? F extends keyof T
    ? Get<T[F], R, T[F]>
    : never
  : res;
type RemoveSlash<S extends string> = Join<Split<S, "/">, "">;

type FlatUnionArr<U> = U extends U
  ? U extends (infer R)[]
    ? R
    : never
  : never;

type Shift<T extends any[]> = T extends [infer R1, ...infer R2] ? R2 : T;
