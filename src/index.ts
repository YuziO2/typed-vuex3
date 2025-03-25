// @ts-nocheck
import Vue from 'vue';
import Vuex from 'vuex';
import type { Store, StoreOptions as VuexStoreOptions } from 'vuex/types/index.js';

Vue.use(Vuex);

export function createTypedStore<StoreOptions extends VuexStoreOptions<any>>(storeOptions: StoreOptions) {
  // 基础 ModuleMap
  type BaseModuleMap = {
    [K in keyof StoreOptions['modules']]: StoreOptions['modules'][K];
  };

  type GetRootProp<K, Keys = 'state' | 'getters' | 'actions' | 'mutations'> = K extends Keys
    ? K extends keyof StoreOptions
      ? StoreOptions[K]
      : {}
    : {};
  /** 命名空间路径 */
  type ModulesPath = FlatUnionArr<ExtractModulesPaths<BaseModuleMap>>;
  type ModulesKey = {
    [K in ModulesPath as Join<Split<RemoveSlash<K>, 'modules'>, '/'>]: TrimArrayBoth<Split<K, '/'>>;
  };

  // 最终的 ModuleMap
  type ModuleMap = {
    [K in keyof ModulesKey]: Get<BaseModuleMap, ModulesKey[K]>;
  };

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
  type FlatModuleProperty<K extends string = 'getters'> = UnionToIntersection<
    {
      [M in keyof ModuleMap]: ModuleMap[M] extends { [key in K]: infer S }
        ? S extends (...args: any[]) => infer R
          ? AddKeyPrefix<R, `${M & string}/`> // 如果是函数，处理其返回值
          : AddKeyPrefix<S, `${M & string}/`> // 如果是对象，直接处理
        : {};
    }[keyof ModuleMap]
  >;


  /** 仅供 MapStates({a: (state:NestedState) => state.a}) 使用 */
  type NestedState = FlattenModuleState<BaseModuleMap> & GetRootProp<'state'>

  /** 供传命名空间的 mapState 使用 */
  type MappedState = {
    [K in keyof ModuleMap as 'state' extends keyof ModuleMap[K] ? K: never]: ModuleMap[K]['state'] extends (...args: any[]) => any
      ? ReturnType<ModuleMap[K]['state']>
      : ModuleMap[K]['state'];
  };
  type FlattedState = FlatModuleProperty<'state'> & GetRootProp<'state'>;

  /** 供传命名空间的 mapGetters 使用 */
  type MappedGetters = {
    [K in keyof ModuleMap as 'getters' extends keyof ModuleMap[K] ? K : never]: ModuleMap[K] extends {
      [key in 'getters']: { [key: string]: (...args: any) => any };
    }
      ? Getter<ModuleMap[K]['getters']>
      : never;
  };
  /** 供不传命名空间的 mapGetters 使用 */
  type FlattedGetters = Getter<FlatModuleProperty<'getters'>> &
    Getter<GetRootProp<'getters'>>;

  // 处理 store 的 mutations 类型
  // 将 mutation 函数名及 payload 类型转换成 commit 函数的两个入参类型
  type FlattedCommit = FlatModuleProperty<'mutations'> & GetRootProp<'mutations'>; // 无命名空间时使用
  type MappedCommit = {
    [K in keyof ModuleMap as 'mutations' extends keyof ModuleMap[K] ? K : never]: ModuleMap[K] extends {
      [key in 'mutations']: { [key: string]: (...args: any[]) => any };
    }
      ? ModuleMap[K]['mutations']
      : never;
  };

  type FlattedDispatch = FlatModuleProperty<'actions'> & GetRootProp<'actions'>; // 无命名空间时使用
  type MappedDispatch = {
    [K in keyof ModuleMap as 'actions' extends keyof ModuleMap[K] ? K : never]: ModuleMap[K] extends {
      [key in 'actions']: { [key: string]: (...args: any[]) => any };
    }
      ? ModuleMap[K]['actions']
      : never;
  };

  const store = new Vuex.Store(storeOptions);

  // mapState 函数重载声明
  function mapState<
    M extends keyof MappedState, // 去掉根模块，它的键不能作为命名空间，根store有getter、mutation、action时，同理也要去掉其map函数声明中有命名空间时的取值
    K extends keyof MappedState[M]
  >(namespace: M, map: K[]): { [Key in K]: () => MappedState[M][Key] }; // 有命名空间，map是数组
  function mapState<K extends keyof GetRootProp<'state'>>(map: K[]): { [Key in K]: () => GetRootProp<'state'>[Key] }; // 没有命名空间，map是数组，state只能是根store里的state
  function mapState<T extends { [key: string]: (state: NestedState) => any }>(
    map: T
  ): { [Key in keyof T]: () => ReturnType<T[Key]> }; // 没有命名空间，map是对象，state应该是NestedState
  function mapState<
    M extends keyof MappedState, // 去掉根模块，它的键不能作为命名空间
    T extends { [key: string]: (state: MappedState[M]) => any }
  >(namespace: M, map: T): { [Key in keyof T]: () => ReturnType<T[Key]> }; // 有命名空间，map是对象

  // mapState 函数实现
  function mapState(...args: any[]): any {
    return Vuex.mapState(...args);
  }

  // mapGetters 函数重载声明
  function mapGetters<
    M extends keyof MappedGetters,
    K extends keyof MappedGetters[M]
  >(namespace: M, map: K[]): { [Key in K]: () => MappedGetters[M][Key] }; // 有命名空间，map是数组
  function mapGetters<K extends keyof FlattedGetters>(map: K[]): { [Key in K]: () => FlattedGetters[Key] }; // 没有命名空间，map是数组
  function mapGetters<T extends { [key: string]: keyof FlattedGetters }>(
    map: T
  ): { [Key in keyof T]: () => FlattedGetters[T[Key]] }; // 没有命名空间，map是对象
  function mapGetters<
    M extends keyof MappedGetters,
    T extends { [key: string]: keyof MappedGetters[M] }
  >(namespace: M, map: T): { [Key in keyof T]: () => MappedGetters[M][T[Key]] }; // 有命名空间，map是对象

  // mapGetters 函数实现
  function mapGetters(...args: any[]): any {
    return Vuex.mapGetters(...args);
  }

  /** 解决mutations或actions的payload为undefined的情况 */
  type ConditionalPayloadFunction<P, R> = undefined extends P ? (payload?: P) => R : (payload: P) => R;

  // mapMutations 函数重载声明
  function mapMutations<K extends keyof FlattedCommit>(
    map: K[]
  ): {
    [Key in K]: ConditionalPayloadFunction<Parameters<FlattedCommit[Key]>[1],ReturnType<FlattedCommit[Key]>>;
  }; // 没有命名空间，map是数组
  function mapMutations<T extends { [key: string]: keyof FlattedCommit }>(
    map: T
  ): {
    [Key in keyof T]: ConditionalPayloadFunction<Parameters<FlattedCommit[T[Key]]>[1],ReturnType<FlattedCommit[T[Key]]>>;
  }; // 没有命名空间，map是对象
  function mapMutations<
    M extends keyof MappedCommit,
    K extends keyof MappedCommit[M]
  >(
    namespace: M,
    map: K[]
  ): {
    [Key in K]: MappedCommit[M][Key] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<Parameters<MappedCommit[M][Key]>[1], ReturnType<MappedCommit[M][Key]>>
      : never;
  }; // 有命名空间，map是数组
  function mapMutations<
    M extends keyof MappedCommit,
    T extends { [key: string]: keyof MappedCommit[M] }
  >(
    namespace: M,
    map: T
  ): {
    [Key in keyof T]: MappedCommit[M][T[Key]] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<Parameters<MappedCommit[M][T[Key]]>[1], ReturnType<MappedCommit[M][T[Key]]>>
      : never;
  }; // 有命名空间，map是对象

  // mapMutations 函数实现
  function mapMutations(...args: any[]): any {
    return Vuex.mapMutations(...args);
  }

  // mapActions 函数重载声明
  function mapActions<K extends keyof FlattedDispatch>(
    map: K[]
  ): {
    [Key in K]: ConditionalPayloadFunction<Parameters<FlattedDispatch[Key]>[1],ReturnType<FlattedDispatch[Key]> >;
  }; // 没有命名空间，map是数组
  function mapActions<T extends { [key: string]: keyof FlattedDispatch }>(
    map: T
  ): {
    [Key in keyof T]: ConditionalPayloadFunction<Parameters<FlattedDispatch[T[Key]]>[1],ReturnType<FlattedDispatch[T[Key]]>>;
  }; // 没有命名空间，map是对象
  function mapActions<
    M extends keyof MappedDispatch,
    K extends keyof MappedDispatch[M]
  >(
    namespace: M,
    map: K[]
  ): {
    [Key in K]: MappedDispatch[M][Key] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<Parameters<MappedDispatch[M][Key]>[1], ReturnType<MappedDispatch[M][Key]>>
      : never;
  }; // 有命名空间，map是数组
  function mapActions<
    M extends keyof MappedDispatch,
    T extends { [key: string]: keyof MappedDispatch[M] }
  >(
    namespace: M,
    map: T
  ): {
    [Key in keyof T]: MappedDispatch[M][T[Key]] extends (...args: any[]) => any
      ? ConditionalPayloadFunction<Parameters<MappedDispatch[M][T[Key]]>[1], ReturnType<MappedDispatch[M][T[Key]]>>
      : never;
  }; // 有命名空间，map是对象

  // mapActions 函数实现
  function mapActions(...args: any[]): any {
    return Vuex.mapActions(...args);
  }

  return {
    store: store as unknown as Omit<Store<StoreOptions>, 'state' | 'getters' | 'commit' | 'dispatch'> & {
      state: NestedState;
      getters: FlattedGetters;
      commit: Commit<FlattedCommit>;
      dispatch: Dispatch<FlattedDispatch>;
    },
    mapState,
    mapGetters,
    mapMutations,
    mapActions,
  };
}

/** 根据modules的嵌套关系，返回路径及其state对应的类型 */
type FlattenModuleState<T> = {
  [K in keyof T]: T[K] extends { state: infer S; modules: infer M }
    ? S extends (...args: any[]) => any 
      ? ReturnType<S> & FlattenModuleState<M>
      : S & FlattenModuleState<M>
    : T[K] extends { state: infer S }
      ? S extends (...args: any[]) => any 
        ? ReturnType<S> 
        : S
      : T[K];
};

/** 将 getter 函数转换成 {getterName: getterFuncsReturnType} 的对象类型 */
export type Getter<T extends { [key: string]: (...args: any) => any }> = {
  [P in keyof T]: ReturnType<T[P]>;
};

/** 供commit函数使用 */
export type Commit<T extends { [key: string]: (...args: any[]) => any }> = {
  <K extends keyof T>(type: K, ...args: undefined extends Parameters<T[K]>[1] ? [] : [Parameters<T[K]>[1]]): ReturnType<
    T[K]
  >;
  <K extends keyof T>(type: K, payload: Parameters<T[K]>[1]): ReturnType<T[K]>;
};

/** 供dispatch函数使用 */
export type Dispatch<T extends { [key: string]: (...args: any[]) => any }> = Commit<T>;

/**
 * 将联合类型转为交叉类型
 * @example1
 * ```
 * UnionToIntersection<{a:string} | {b:number} | {c:boolean}> // {a:string} & {b:number} & {c:boolean}
 * ```
 * @example2
 * ```
 * UnionToIntersection<'a' | 'b' | 'c'> // never
 * ```
 * 原理
 * 输入：'a' | 'b' | 'c'
 * 过程：
 * 1. Union 被分发到 (k: U) => void 中：(k: 'a') => void | (k: 'b') => void | (k: 'c') => void
 * 2. TypeScript 在函数参数位置会将联合类型转换为交叉类型：(k: 'a' & 'b' & 'c') => void
 * 3. 通过 infer I 提取参数类型：'a' & 'b' & 'c' 即为： never
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * 将一个对象的所有 key 添加前缀
 * @example
 * ```
 * AddKeyPrefix<{a:string,b:string},'example_'> // {example_a:string,example_b:string}
 */
type AddKeyPrefix<T, P extends string> = {
  [K in keyof T as `${P}${string & K}`]: T[K];
};

/**
 * @example
 * ```
 * type ExampleBaseModulesPaths = {
 *  user: {
 *    state: { name: string }
 *    modules: {
 *      profile: {
 *        state: { age: number }
 *        modules: {
 *          settings: {
 *            state: { theme: string }
 *          }
 *        }
 *      }
 *    }
 *  }
 *  auth: {
 *    state: { loggedIn: boolean }
 *  }
 * }
 * type t = ExtractModulesPaths<ExampleBaseModulesPaths> //t为 ["/user/", "/user/modules/profile/", "/user/modules/profile/modules/settings/"] | ["/auth/"]
 */
type ExtractModulesPaths<T, K extends keyof T = keyof T, P extends string = '', res extends string[] = []> = K extends string
  ? T[K] extends { modules: infer M }
    ? [keyof M] extends [never]
      ? [...res, `${P}/${K}/`]
      :ExtractModulesPaths<M, keyof M, `${P}/${K}/modules`, [...res, `${P}/${K}/`]>
    : [...res, `${P}/${K}/`]
  : res;

/**
 * 将数组联合类型转为联合类型
 * @example
 * ```
 * type U = ["/user/", "/user/modules/profile/", "/user/modules/profile/modules/settings/"] | ["/auth/"]
 * type t = FlatUnionArr<U> //t为 "/user/" | "/user/modules/profile/" | "/user/modules/profile/modules/settings/" | "/auth/"
 */
type FlatUnionArr<U> = U extends U ? (U extends (infer R)[] ? R : never) : never;

/**
 * 删除数组的第一个元素
 */
type Shift<T extends any[]> = T extends [infer R1, ...infer R2] ? R2 : T;

/**
 * 删除所有的 ‘/’
 */
type RemoveSlash<S extends string> = Join<Split<S, '/'>, ''>;

/**
 * 将字符串按指定分隔符分割成数组
 * @example1
 * type t = Split<'a/b/c', '/'>; // ['a', 'b', 'c']
 * @example2
 * type t2 = Split<'a/b/', '/'>; // ['a', 'b', '']
 * @example3
 * type t3 = Split<'/', '/'>; // ['', '']
 */
type Split<T extends string, S extends string> = T extends `${infer Head}${S}${infer Tail}`
  ? [Head, ...Split<Tail, S>]
  : [T];

/**
 * 将数组按指定连接符连接成字符串
 * @example1
 * type t = Join<['a', 'b', 'c'], '/'>; // 'a/b/c'
 * @example2
 * type t2 = Join<['a', 'b', ''], '/'>; // 'a/b/'
 * @example3
 * type t3 = Join<['', 'a'], '/'>; // '/a'
 * @example4
 * type t4 = Join<['a'], '/'>; // 'a'
 * @example5
 * type t5 = Join<[], '/'>; // ''
 */
type Join<T extends any[], S extends string> = T extends [infer Head, ...infer Tail]
  ? `${Head & string}${Tail extends [] ? '' : S}${Join<Tail, S>}`
  : '';

/**
 * 获取对象的指定路径的值
 * @example1
 * type t = Get<{ a: { b: { c: string } } }, ['a', 'b', 'c']>; // string
 * @example2
 * type t2 = Get<{ a: { b: { c: string } } }, ['a', 'b']>; // { c: string }
 * @example3
 * type t3 = Get<{ a: { b: { c: string } } }, ['a', 'c']>; // never
 */
type Get<T = Record<string, any>, Path extends (string | number | symbol)[] = [], Default = never> = Path extends []
  ? T
  : Path extends [infer First, ...infer Rest]
  ? First extends keyof T
    ? Rest extends (string | number | symbol)[]
      ? Get<T[First], Rest, Default>
      : Default
    : Default
  : Default;

/** 删除数组前面为空串的元素 */
type TrimArrayStart<T extends string[]> = 
  T extends [infer S, ...infer Rest]
    ? S extends ''
      ? TrimArrayStart<Rest extends string[]? Rest: []>
      : T
    : T;

/** 删除数组后面为空串的元素 */
type TrimArrayEnd<T extends string[]> = 
  T extends [...infer Rest, infer S]
    ? S extends ''
      ? TrimArrayEnd<Rest extends string[]? Rest: []>
      : T
    : T;

/** 删除数组前后为空串的元素 */
type TrimArrayBoth<T extends string[]> = 
  TrimArrayEnd<TrimArrayStart<T>>;