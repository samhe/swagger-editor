import deepMerge from "deepmerge"
import SwaggerUI from "swagger-ui"
import EditorLayout from "./layout"
import "swagger-ui/dist/swagger-ui.css"

import EditorPlugin from "./plugins/editor"
import LocalStoragePlugin from "./plugins/local-storage"
import ValidateBasePlugin from "./plugins/validate-base"
import ValidateSemanticPlugin from "./plugins/validate-semantic"
import ValidateJsonSchemaPlugin from "./plugins/validate-json-schema"
import EditorAutosuggestPlugin from "./plugins/editor-autosuggest"
import EditorAutosuggestSnippetsPlugin from "./plugins/editor-autosuggest-snippets"
import EditorAutosuggestKeywordsPlugin from "./plugins/editor-autosuggest-keywords"
import EditorAutosuggestOAS3KeywordsPlugin from "./plugins/editor-autosuggest-oas3-keywords"
import EditorAutosuggestRefsPlugin from "./plugins/editor-autosuggest-refs"
import PerformancePlugin from "./plugins/performance"
import JumpToPathPlugin from "./plugins/jump-to-path"
import SplitPaneModePlugin from "./plugins/split-pane-mode"
import ASTPlugin from "./plugins/ast"

// eslint-disable-next-line no-undef
const { GIT_DIRTY, GIT_COMMIT, PACKAGE_VERSION } = buildInfo

window.versions = window.versions || {}
window.versions.swaggerEditor = `${PACKAGE_VERSION}/${GIT_COMMIT || "unknown"}${GIT_DIRTY ? "-dirty" : ""}`
const plugins = {
  EditorPlugin,
  ValidateBasePlugin,
  ValidateSemanticPlugin,
  ValidateJsonSchemaPlugin,
  LocalStoragePlugin,
  EditorAutosuggestPlugin,
  EditorAutosuggestSnippetsPlugin,
  EditorAutosuggestKeywordsPlugin,
  EditorAutosuggestRefsPlugin,
  EditorAutosuggestOAS3KeywordsPlugin,
  PerformancePlugin,
  JumpToPathPlugin,
  SplitPaneModePlugin,
  ASTPlugin,
}

const csAPISepcURL = "http://localhost:3000/apiSpecs"
const token = "accessToken"
const getAPISpecList = async () => {
  const res = await fetch(csAPISepcURL, {
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Token": token
    }
  })
  return await res.json()
}
const getAPISpecById = async (id) => {
  const res = await fetch(csAPISepcURL + "/" + id, {
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Token": token
    }
  })
  return await res.json()
}
const uploadAPISpec = async (apiSpec) => {
  let res
  if(apiSpec.id) {
    res = await fetch(csAPISepcURL + "/" + apiSpec.id, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Token": token
      },
      method: "PUT",
      body: JSON.stringify(apiSpec)
    })
  } else {
    res = await fetch(csAPISepcURL, {
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Token": token
      },
      method: "POST",
      body: JSON.stringify(apiSpec)
    })
  }
  return await res.json()
}
const defaults = {
  dom_id: "#swagger-editor", // eslint-disable-line camelcase, we have this prop for legacy reasons.
  layout: "EditorLayout",
  presets: [
    SwaggerUI.presets.apis
  ],
  plugins: Object.values(plugins),
  components: {
    EditorLayout
  },
  showExtensions: true,
  swagger2GeneratorUrl: "https://generator.swagger.io/api/swagger.json",
  oas3GeneratorUrl: "https://generator3.swagger.io/api/swagger.json",
  csAPISpecActions: {
    apiSpecId: "",
    getAPISpecList,
    getAPISpecById,
    uploadAPISpec
  }
}

module.exports = function SwaggerEditor(options) {
  let mergedOptions = deepMerge(defaults, options)

  mergedOptions.presets = defaults.presets.concat(options.presets || [])
  mergedOptions.plugins = defaults.plugins.concat(options.plugins || [])
  return SwaggerUI(mergedOptions)
}

module.exports.plugins = plugins
