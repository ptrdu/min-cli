import * as changeCase from 'change-case'
import { Depend, Request, WxSFM } from '../class'
import { CompileType } from '../declare'
import { config, dom, beautifyHtml, Global, getOuterHTML } from '../util'

const htmlparser = require('htmlparser2')
const PID_KEY = '_pid'

export namespace WxSFMTemplate {
  export interface Options {

    /**
     * 编译类型
     *
     * @type {CompileType}
     * @memberof Options
     */
    compileType?: CompileType

    /**
     * 引用组件
     *
     * @type {{ [key: string]: string }}
     * @memberof Options
     */
    usingComponents?: {
      [key: string]: string
    }
  }
}

/**
 * TEMPLATE 模块类
 *
 * @export
 * @class WxSFMTemplate
 * @extends {WxSFM}
 */
export class WxSFMTemplate extends WxSFM {

  /**
   * 依赖列表
   *
   * @private
   * @type {Depend[]}
   * @memberof WxSFMTemplate
   */
  private depends: Depend[] = []

  /**
   * DOM 树
   *
   * @type {*}
   * @memberof WxSFMTemplate
   */
  dom: any

  /**
   * 自定义标签元素列表，它是this.dom 内与 usingComponents 引用匹配的元素集合
   *
   * @type {any[]}
   * @memberof WxSFMTemplate
   */
  customElems: any[] = []

  /**
   * example 元素，它是this.dom内第一个 <example></example> 标签嵌套的元素
   *
   * @type {*}
   * @memberof WxSFMTemplate
   */
  exampleElem: any

  /**
   * demo-xxx 元素列表，它是this.dom内第一个 <example></example> 标签内 所有的<demo-xxx></demo-xxx> 标签嵌套的元素集合
   *
   * @type {any[]}
   * @memberof WxSFMTemplate
   */
  demoElems: any[] = []

  /**
   * Creates an instance of WxSFMTemplate.
   * @param {string} source
   * @param {Request} request
   * @param {CompileType} compileType
   * @memberof WxSFMTemplate
   */
  constructor (source: string, request: Request, public options: WxSFMTemplate.Options) {
    super(source, request, {
      destExt: config.ext.wxml
    })
    this.initDom()
  }

  /**
   * 初始化 DOM 节点树
   *
   * @private
   * @memberof WxSFMTemplate
   */
  private initDom () {
    if (!this.source) return

    let { usingComponents = {} } = this.options

    // 只有.wxp页面才可以使用公共模板
    let source = !this.isWxp ? this.source : Global.layout.app.template.replace(config.layout.placeholder, this.source)

    this.dom = dom.make(source)

    // get all custom tag
    this.customElems = htmlparser.DomUtils.getElementsByTagName((name: string) => {
      return !!usingComponents[name]
    }, this.dom, true, [])

    // get one <example...> tag
    this.exampleElem = htmlparser.DomUtils.getElementsByTagName('example', this.dom, true, [])[0] || null

    if (!this.exampleElem) return

    // get all <demo-...> tag
    this.demoElems = htmlparser.DomUtils.getElementsByTagName((name: string) => {
      return /^demo-/.test(name)
    }, this.exampleElem, true, [])
  }

  /**
   * 设置 自定义标签的 pid 属性
   *
   * @private
   * @memberof WxSFMTemplate
   */
  private setCustomTagPidAttr () {
    // set _pid
    this.customElems.forEach((elem: any) => {
      elem.attribs = elem.attribs || {}
      elem.attribs[PID_KEY] = `{{${PID_KEY}}}`
    })
  }

  /**
   * 添加 用于输出展示 doc-intro 和 doc-api 的 example-md 标签
   *
   * @private
   * @memberof WxSFMTemplate
   */
  private addExampleMdDocTag () {
    if (!this.exampleElem) return

    // 插入一个 example-md 标签，并传入 content 属性，用于读取data上的 README.md 文件转后的 html 内容
    htmlparser.DomUtils.appendChild(this.exampleElem, {
      type: 'tag',
      name: 'example-md',
      attribs: {
        content: '{{__code__.readme}}',
        [PID_KEY]: `{{${PID_KEY}}}`
      }
    }, null)

    // // 插入一个 example-md 标签，并传入 content 属性，用于读取data上的 doc-intro.md 文件转后的 html 内容
    // htmlparser.DomUtils.appendChild(this.exampleElem, {
    //   type: 'tag',
    //   name: 'example-md',
    //   attribs: {
    //     content: '{{__code__.docIntro}}',
    //     [PID_KEY]: `{{${PID_KEY}}}`
    //   }
    // }, null)

    // // 插入一个 example-md 标签，并传入 content 属性，用于读取data上的 doc-api.md 文件转后的 html 内容
    // htmlparser.DomUtils.appendChild(this.exampleElem, {
    //   type: 'tag',
    //   name: 'example-md',
    //   attribs: {
    //     content: '{{__code__.docApi}}',
    //     [PID_KEY]: `{{${PID_KEY}}}`
    //   }
    // }, null)

    // // 插入一个 example-md 标签，并传入 content 属性，用于读取data上的 doc-changelog.md 文件转后的 html 内容
    // htmlparser.DomUtils.appendChild(this.exampleElem, {
    //   type: 'tag',
    //   name: 'example-md',
    //   attribs: {
    //     content: '{{__code__.docChangeLog}}',
    //     [PID_KEY]: `{{${PID_KEY}}}`
    //   }
    // }, null)
  }

  /**
   * 设置 example-demo 的 source 属性，用于展示 <demo-xxx></demo-xxx> 组件的源代码
   *
   * @private
   * @memberof WxSFMTemplate
   */
  private setExampleDemoSourceAttr () {
    if (!this.exampleElem) return

    // <demo-default></demo-default>
    this.demoElems.forEach((elem: any) => {
      let { parent } = elem
      // <example-demo title="" desc="">
      if (parent.name === 'example-demo' && !parent.attribs['source']) {
        let pcName = changeCase.camelCase(elem.name)
        parent.attribs['source'] = `{{__code__.${pcName}}}`
      }
    })
  }

  /**
   * 生成代码
   *
   * @returns {string}
   * @memberof WxSFMTemplate
   */
  generator(): string {
    let code = ''
    if (!this.dom) return code

    this.setCustomTagPidAttr()
    this.addExampleMdDocTag()
    this.setExampleDemoSourceAttr()

    // code = htmlparser.DomUtils.getOuterHTML(this.dom)
    code = getOuterHTML(this.dom)
    code = beautifyHtml(code)

    return code
  }

  /**
   * 保存文件
   *
   * @memberof WxSFMTemplate
   */
  save() {
    if (this.request.isWxa) {
      return
    }
    super.save()
  }

  /**
   * 移除文件
   *
   * @memberof WxSFMTemplate
   */
  remove () {
    super.remove()
  }

  /**
   * 获取依赖列表
   *
   * @returns {Depend[]}
   * @memberof WxSFMTemplate
   */
  getDepends (): Depend[] {
    return this.depends
  }

  /**
   * 更新依赖列表
   *
   * @param {Request.Core[]} useRequests 可用的请求列表
   * @memberof WxSFMTemplate
   */
  updateDepends (useRequests: Request.Core[]): void {
  }
}
