import React from "react"
import PropTypes from "prop-types"
import Swagger from "swagger-client"
import URL from "url"
import "whatwg-fetch"
import DropdownMenu from "./DropdownMenu"
import reactFileDownload from "react-file-download"
import YAML from "@kyleshockey/js-yaml"
import beautifyJson from "json-beautify"

import "react-dd-menu/dist/react-dd-menu.css"
import Logo from "./logo_small.png"

import CSAPIInfo from "./csapi/CSAPIInfo"

class OAS3GeneratorMessage extends React.PureComponent {
  render() {
    const { isShown } = this.props

    if(!isShown) {
      return null
    }

    return <div onClick={this.props.showModal} className="long-menu-message">
      Beta feature; click for more info.
    </div>
  }
}

export default class Topbar extends React.Component {
  constructor(props, context) {
    super(props, context)

    this.state = {
      swaggerClient: null,
      clients: [],
      servers: [],
      definitionVersion: "Unknown",
      csAPISpecList: [],
      csAPISpecToUpload: {},
      csAPISpecDiffs: {}
    }
  }

  getGeneratorUrl = () => {
    const { isOAS3, isSwagger2 } = this.props.specSelectors
    const { swagger2GeneratorUrl, oas3GeneratorUrl } = this.props.getConfigs()

    return isOAS3() ? oas3GeneratorUrl : (
      isSwagger2() ? swagger2GeneratorUrl : null
    )
  }

  instantiateGeneratorClient = () => {

    const generatorUrl = this.getGeneratorUrl()

    if(!generatorUrl) {
      return this.setState({
        clients: [],
        servers: []
      })
    }

    Swagger(generatorUrl, {
      requestInterceptor: (req) => {
        req.headers["Accept"] = "application/json"
        req.headers["Content-Type"] = "application/json"
      }
    })
    .then(client => {
      this.setState({
        swaggerClient: client
      })
      client.apis.clients.clientOptions({}, {
        // contextUrl is needed because swagger-client is curently
        // not building relative server URLs correctly
        contextUrl: generatorUrl
      })
      .then(res => {
        this.setState({ clients: res.body || [] })
      })
      client.apis.servers.serverOptions({}, {
        // contextUrl is needed because swagger-client is curently
        // not building relative server URLs correctly
        contextUrl: generatorUrl
      })
      .then(res => {
        this.setState({ servers: res.body || [] })
      })
    })
  }

  preloadAPISpec = async () => {
    const initAPISpecId = this.props.getConfigs().csAPISpecActions.apiSpecId
    if(initAPISpecId) {
      await this.getCSAPISpecById(initAPISpecId)
    }
  }

  downloadFile = (content, fileName) => {
    if(window.Cypress) {
      // HACK: temporary workaround for https://github.com/cypress-io/cypress/issues/949
      // allows e2e tests to proceed without choking on file download native event
      return
    }
    return reactFileDownload(content, fileName)
  }
  // Menu actions
  openCSAPISpecListModal = async () => {
    await this.getCSAPISpecList()
    this.showModal("csAPISpecListModal")
  }
  openCSAPISpecUploadModal = async (type) => {
    const isNew = type === "new"
    this.generateAPISpecAndDiffsBeforeUpload(isNew)
    this.setState({csAPISpecUploadModalType: (isNew ? "new" : "edit")})
    await this.getCSAPISpecList()
    this.showModal("csAPISpecUploadModal")
  }
  /**
   * returns current spec's leading info as array, like: ["[GET]/openapi/a"]
   */
  getCurrentAPISpecLeadingInfo = () => {
    const leadingInfo = []
    const specSelectors = this.props.specSelectors
    const baseURL = specSelectors.basePath()
    const paths = specSelectors.paths().toObject()
    Object.keys(paths).forEach(path => {
      const pathObj = paths[path].toObject()
      Object.keys(pathObj).forEach(method => leadingInfo.push(`[${method.toUpperCase()}]${baseURL}${path}`))
    })
    return leadingInfo
  }
  generateAPISpecAndDiffsBeforeUpload = (isForNew) => {
    const originLeadingInfo = this.state.csAPISpecToUpload["leadingInfo"]
    const leadingInfo = this.getCurrentAPISpecLeadingInfo()
    if(!this.hasParserErrors() && !this.hasSchemaErrors() && Array.isArray(originLeadingInfo) && Array.isArray(leadingInfo)) {
      const news = leadingInfo.filter(apiInfo => !originLeadingInfo || !originLeadingInfo.includes(apiInfo))
      const dels = originLeadingInfo.filter(apiInfo => !leadingInfo || !leadingInfo.includes(apiInfo))
      this.setState({"csAPISpecDiffs": {news, dels}})
    } else {
      this.setState({"csAPISpecDiffs": {news:[], dels:[]}})
    }
    let csAPISpec = {}
    if(!isForNew) {
      csAPISpec = JSON.parse(JSON.stringify(this.state.csAPISpecToUpload))
    }
    csAPISpec.spec = YAML.safeLoad(this.props.specSelectors.specStr())
    csAPISpec.leadingInfo = leadingInfo
    this.setState({"csAPISpecToUpload": csAPISpec})

  }
  getAPIInfoStyle = (apiInfo) => {
    if(this.state.csAPISpecDiffs.news && this.state.csAPISpecDiffs.news.includes(apiInfo)) {
      return {color: "green"}
    }
    if(this.state.csAPISpecDiffs.dels && this.state.csAPISpecDiffs.dels.includes(apiInfo)) {
      return {color: "red", "text-decoration" : "line-through"}
    }
    return {}
  }
  getCSAPISpecList = async () => {
    const apiSpecList = await this.props.getConfigs().csAPISpecActions.getAPISpecList()
    this.setState({"csAPISpecList": apiSpecList})
  }

  getCSAPISpecById = async (id) => {
    const apiSpec = await this.props.getConfigs().csAPISpecActions.getAPISpecById(id)
    this.setState({"csAPISpecToUpload": apiSpec})
    this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(JSON.stringify(apiSpec.spec))))
    this.hideModal("csAPISpecListModal")
  }

  handleCSAPISpecInputChange = (event) => {
    const target = event.target
    const value = target.type === "checkbox" ? target.checked : target.value
    const name = target.name

    const csAPISpec = JSON.parse(JSON.stringify(this.state.csAPISpecToUpload))
    csAPISpec[name] = value

    this.setState({ "csAPISpecToUpload": csAPISpec })
  }

  setCSAPISepcInfoBeforeUpload = ({id, name, leadingInfo}) => {
    let csAPISpec = JSON.parse(JSON.stringify(this.state.csAPISpecToUpload))
    csAPISpec = { ...csAPISpec, id, name, leadingInfo}
    this.setState({"csAPISpecToUpload": csAPISpec}, () => {
      this.generateAPISpecAndDiffsBeforeUpload()
    })
    // this.generateAPISpecAndDiffsBeforeUpload()
  }

  uploadCSAPISpec = async () => {
    if(this.hasParserErrors() || this.hasSchemaErrors()) {
      return alert("Please correct the schema error before upload")
    }
    if(!this.state.csAPISpecToUpload.name) {
      return alert("Please define the name of the API spec.")
    }
    try {
      const csAPISpec = JSON.parse(JSON.stringify(this.state.csAPISpecToUpload))
      csAPISpec.spec = YAML.safeLoad(this.props.specSelectors.specStr())

      const uploadedAPISpec = await this.props.getConfigs().csAPISpecActions.uploadAPISpec(csAPISpec)
      this.setState({"csAPISpecToUpload": uploadedAPISpec})
      alert("Upload successfully!")
      return this.hideModal("csAPISpecUploadModal")
    } catch (err) {
      return alert("Failed to upload the API Spec.", err)
    }
  }

  importFromURL = () => {
    let url = prompt("Enter the URL to import from:")

    if(url) {
      fetch(url)
        .then(res => res.text())
        .then(text => {
          this.props.specActions.updateSpec(
            YAML.safeDump(YAML.safeLoad(text), {
              lineWidth: -1
            })
          )
        })
    }
  }

  importFromFile = () => {
    let fileToLoad = this.refs.fileLoadInput.files.item(0)
    let fileReader = new FileReader()

    fileReader.onload = fileLoadedEvent => {
      let textFromFileLoaded = fileLoadedEvent.target.result
      this.props.specActions.updateSpec(YAML.safeDump(YAML.safeLoad(textFromFileLoaded)))
      this.hideModal()
    }

    fileReader.readAsText(fileToLoad, "UTF-8")
  }

  saveAsYaml = () => {
    let editorContent = this.props.specSelectors.specStr()
    let language = this.getDefinitionLanguage()
    let fileName = this.getFileName()

    if(this.hasParserErrors()) {
      if(language === "yaml") {
        const shouldContinue = confirm("Swagger-Editor isn't able to parse your API definition. Are you sure you want to save the editor content as YAML?")
        if(!shouldContinue) return
      } else {
        return alert("Save as YAML is not currently possible because Swagger-Editor wasn't able to parse your API definiton.")
      }
    }

    if(language === "yaml") {
      //// the content is YAML,
      //// so download as-is
      return this.downloadFile(editorContent, `${fileName}.yaml`)
    }

    //// the content is JSON,
    //// so convert and download

    // JSON String -> JS object
    let jsContent = YAML.safeLoad(editorContent)
    // JS object -> YAML string
    let yamlContent = YAML.safeDump(jsContent)
    this.downloadFile(yamlContent, `${fileName}.yaml`)
  }

  saveAsJson = () => {
    let editorContent = this.props.specSelectors.specStr()
    let fileName = this.getFileName()

    if(this.hasParserErrors()) {
      // we can't recover from a parser error in save as JSON
      // because we are always parsing so we can beautify
      return alert("Save as JSON is not currently possible because Swagger-Editor wasn't able to parse your API definiton.")
    }

    // JSON or YAML String -> JS object
    let jsContent = YAML.safeLoad(editorContent)
    // JS Object -> pretty JSON string
    let prettyJsonContent = beautifyJson(jsContent, null, 2)
    this.downloadFile(prettyJsonContent, `${fileName}.json`)
  }

  saveAsText = () => {
    // Download raw text content
    console.warn("DEPRECATED: saveAsText will be removed in the next minor version.")
    let editorContent = this.props.specSelectors.specStr()
    let isOAS3 = this.props.specSelectors.isOAS3()
    let fileName = isOAS3 ? "openapi.txt" : "swagger.txt"
    this.downloadFile(editorContent, fileName)
  }

  convertToYaml = () => {
    // Editor content -> JS object -> YAML string
    let editorContent = this.props.specSelectors.specStr()
    let jsContent = YAML.safeLoad(editorContent)
    let yamlContent = YAML.safeDump(jsContent)
    this.props.specActions.updateSpec(yamlContent)
  }

  downloadGeneratedFile = (type, name) => {
    let { specSelectors } = this.props
    let swaggerClient = this.state.swaggerClient
    if(!swaggerClient) {
      // Swagger client isn't ready yet.
      return
    }

    if(specSelectors.isOAS3()) {
      swaggerClient.apis.default.generate1({}, {
        requestBody: {
          spec: specSelectors.specJson(),
          options: {
            lang: name
          }
        },
        contextUrl: this.getGeneratorUrl()
      }).then(res => {
        this.downloadFile(res.data, `${name}-${type}-generated.zip`)
      })
    } else if(type === "server") {
      swaggerClient.apis.servers.generateServerForLanguage({
        framework : name,
        body: JSON.stringify({
          spec: specSelectors.specJson()
        }),
        headers: JSON.stringify({
          Accept: "application/json"
        })
      })
        .then(res => this.handleResponse(res, { type, name }))
    } else if(type === "client") {
      swaggerClient.apis.clients.generateClient({
        language : name,
        body: JSON.stringify({
          spec: specSelectors.specJson()
        })
      })
        .then(res => this.handleResponse(res, { type, name }))
    }
  }

  handleResponse = (res, { type, name }) => {
    if(!res.ok) {
      return console.error(res)
    }

    let downloadUrl = URL.parse(res.body.link)

    // HACK: workaround for Swagger.io Generator 2.0's lack of HTTPS downloads
    if(downloadUrl.hostname === "generator.swagger.io") {
      downloadUrl.protocol = "https:"
      delete downloadUrl.port
      delete downloadUrl.host
    }

    fetch(URL.format(downloadUrl))
      .then(res => res.blob())
      .then(res => {
        this.downloadFile(res, `${name}-${type}-generated.zip`)
      })
  }

  clearEditor = () => {
    if(window.localStorage) {
      window.localStorage.removeItem("swagger-editor-content")
      this.props.specActions.updateSpec("")
    }
    this.setState("csAPISpecToUpload", {})
  }

  // Helpers
  showModal = (name) => {
    this.setState({
      [name]: true
    })
  }

  hideModal = (name) => {
    this.setState({
      [name]: false
    })
  }

  // Logic helpers
  hasSchemaErrors = () => {
    return this.props.errSelectors.allErrors().filter(err => err.get("source") === "schema").size > 0
  }

  hasParserErrors = () => {
    return this.props.errSelectors.allErrors().filter(err => err.get("source") === "parser").size > 0
  }

  getFileName = () => {
    // Use `isSwagger2` here, because we want to default to `openapi` if we don't know.
    if(this.props.specSelectors.isSwagger2 && this.props.specSelectors.isSwagger2()) {
      return "swagger"
    }

    return "openapi"
  }

  getDefinitionLanguage = () => {
    let editorContent = this.props.specSelectors.specStr() || ""

    if(editorContent.trim()[0] === "{") {
      return "json"
    }

    return "yaml"
  }


  getDefinitionVersion = () => {
    const { isOAS3, isSwagger2 } = this.props.specSelectors

    return isOAS3() ? "OAS3" : (
      isSwagger2() ? "Swagger2" : "Unknown"
    )
  }

  ///// Lifecycle

  componentDidMount() {
    this.instantiateGeneratorClient()
    this.preloadAPISpec()
  }

  componentDidUpdate() {
    const version = this.getDefinitionVersion()

    if(this.state.definitionVersion !== version) {
      // definition version has changed; need to reinstantiate
      // our Generator client
      // --
      // TODO: fix this if there's A Better Way
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        definitionVersion: version
      }, () => this.instantiateGeneratorClient())

    }
  }

  render() {
    let { getComponent, specSelectors: { isOAS3 } } = this.props
    const Link = getComponent("Link")
    const TopbarInsert = getComponent("TopbarInsert")
    const Modal = getComponent("TopbarModal")

    let showServersMenu = this.state.servers && this.state.servers.length
    let showClientsMenu = this.state.clients && this.state.clients.length

    let definitionLanguage = this.getDefinitionLanguage()

    let isJson = definitionLanguage === "json"

    let makeMenuOptions = (name) => {
      let stateKey = `is${name}MenuOpen`
      let toggleFn = () => this.setState({ [stateKey]: !this.state[stateKey] })
      return {
        isOpen: !!this.state[stateKey],
        close: () => this.setState({ [stateKey]: false }),
        align: "left",
        toggle: <span className="menu-item" onClick={toggleFn}>{ name }</span>
      }
    }

    const saveAsElements = []

    if(isJson) {
      saveAsElements.push(<li><button type="button" onClick={this.saveAsJson}>Save as JSON</button></li>)
      saveAsElements.push(<li><button type="button" onClick={this.saveAsYaml}>Convert and save as YAML</button></li>)
    } else {
      saveAsElements.push(<li><button type="button" onClick={this.saveAsYaml}>Save as YAML</button></li>)
      saveAsElements.push(<li><button type="button" onClick={this.saveAsJson}>Convert and save as JSON</button></li>)
    }

    return (
      <div>
        <div className="topbar">
          <div className="topbar-wrapper">
            <Link href="#">
              <img height="30" width="30" className="topbar-logo__img" src={ Logo } alt=""/>
              <span className="topbar-logo__title">Swagger Editor</span>
            </Link>
            <DropdownMenu {...makeMenuOptions("Publish")}>
              <li><button type="button" onClick={() => this.openCSAPISpecListModal()}>Load...</button></li>
              <li><button type="button" onClick={() => this.openCSAPISpecUploadModal()}>Upload as...</button></li>
              <li><button type="button" onClick={() => this.openCSAPISpecUploadModal("new")}>Upload as new...</button></li>
            </DropdownMenu>
            <DropdownMenu {...makeMenuOptions("File")}>
              <li><button type="button" onClick={this.importFromURL}>Import URL</button></li>
              <li><button type="button" onClick={() => this.showModal("fileLoadModal")}>Import File</button></li>
              <li role="separator"></li>
              {saveAsElements}
              <li role="separator"></li>
              <li><button type="button" onClick={this.clearEditor}>Clear editor</button></li>
            </DropdownMenu>
            <DropdownMenu {...makeMenuOptions("Edit")}>
              <li><button type="button" onClick={this.convertToYaml}>Convert to YAML</button></li>
            </DropdownMenu>
            <TopbarInsert {...this.props} />
            { showServersMenu ? <DropdownMenu className="long" {...makeMenuOptions("Generate Server")}>
              <OAS3GeneratorMessage
                showModal={() => this.showModal("generatorModal")}
                hideModal={() => this.hideModal("generatorModal")}
                isShown={isOAS3()} />
              { this.state.servers
                  .map((serv, i) => <li key={i}><button type="button" onClick={this.downloadGeneratedFile.bind(null, "server", serv)}>{serv}</button></li>) }
            </DropdownMenu> : null }
            { showClientsMenu ? <DropdownMenu className="long" {...makeMenuOptions("Generate Client")}>
              <OAS3GeneratorMessage
                showModal={() => this.showModal("generatorModal")}
                hideModal={() => this.hideModal("generatorModal")}
                isShown={isOAS3()} />
              { this.state.clients
                  .map((cli, i) => <li key={i}><button type="button" onClick={this.downloadGeneratedFile.bind(null, "client", cli)}>{cli}</button></li>) }
            </DropdownMenu> : null }
          </div>
        </div>
        {this.state.csAPISpecListModal && <Modal className="modal" onCloseClick={() => this.hideModal("csAPISpecListModal")} styleName="modal-dialog">
          <div className="container modal-message">
            <h2>API Spec List</h2>
            <div>{this.state.csAPISpecList.map(csAPISpec => {
              return <CSAPIInfo key={csAPISpec.id} onSelect={() => this.getCSAPISpecById(csAPISpec.id)} apiSpec={csAPISpec} />
            })}</div>
          </div>
          <div className="right">
            <button className="btn cancel" onClick={() => this.hideModal("csAPISpecListModal")}>Cancel</button>
          </div>
        </Modal>
        }
        {this.state.csAPISpecUploadModal && <Modal className="modal" onCloseClick={() => this.hideModal("csAPISpecUploadModal")} styleName="modal-dialog">
          <div className="container modal-message">
            <h2>API Spec Upload</h2>
            <form>
              <label>Name:  
                <input
                  name="name"
                  type="text"
                  value={this.state.csAPISpecToUpload.name}
                  onChange={this.handleCSAPISpecInputChange} />
              </label>
              {this.state.csAPISpecToUpload.leadingInfo && <ul>
              {
                this.state.csAPISpecToUpload.leadingInfo.map(apiInfo => <li style={this.getAPIInfoStyle(apiInfo)}>{apiInfo}</li>)
              }
              {
                this.state.csAPISpecDiffs.dels && this.state.csAPISpecDiffs.dels.map(deletedApiInfo => {
                  return <li style={this.getAPIInfoStyle(deletedApiInfo)} titile="deleted">{deletedApiInfo}</li>
                })
              }</ul>}
            </form>
            {this.state.csAPISpecUploadModalType !== "new" && (<div>
              <hr/>
              <h2>Select one of existing API to update</h2>
              <div>{this.state.csAPISpecList.map(csAPISpec => {
                return <CSAPIInfo key={csAPISpec.id} onSelect={this.setCSAPISepcInfoBeforeUpload} apiSpec={csAPISpec} />
              })}</div>
            </div>)}
          </div>
          <div className="right">
            <button className="btn cancel" onClick={() => this.hideModal("csAPISpecUploadModal")}>Cancel</button>
            <button className="btn" onClick={this.uploadCSAPISpec}>Upload</button>
          </div>
        </Modal>
        }
        {this.state.fileLoadModal && <Modal className="modal" onCloseClick={() => this.hideModal("fileLoadModal")} styleName="modal-dialog-sm">
          <div className="container modal-message">
            <h2>Upload file</h2>
            <input type="file" ref="fileLoadInput"></input>
          </div>
          <div className="right">
            <button className="btn cancel" onClick={() => this.hideModal("fileLoadModal")}>Cancel</button>
            <button className="btn" onClick={this.importFromFile}>Open file</button>
          </div>
        </Modal>
        }
        {this.state.generatorModal && <Modal className="modal" onCloseClick={() => this.hideModal("generatorModal")}>
          <div className="modal-message">
            <p>
              Code generation for OAS3 is currently work in progress. The available languages is smaller than the for OAS/Swagger 2.0 and is constantly being updated.
            </p>
            <p>
              If you encounter issues with the existing languages, please file a ticket at&nbsp;
              <a href="https://github.com/swagger-api/swagger-codegen-generators" target={"_blank"}>swagger-codegen-generators</a>. Also, as this project highly depends on community contributions - please consider helping us migrate the templates for other languages. Details can be found at the same repository.
            </p>
            <p>
              Thanks for helping us improve this feature.
            </p>
          </div>
          <div className="right">
            <button className="btn" onClick={() => this.hideModal("generatorModal")}>
              Close
            </button>
          </div>
        </Modal>
        }
      </div>
    )
  }
}

Topbar.propTypes = {
  specSelectors: PropTypes.object.isRequired,
  errSelectors: PropTypes.object.isRequired,
  specActions: PropTypes.object.isRequired,
  getComponent: PropTypes.func.isRequired,
  getConfigs: PropTypes.func.isRequired
}
