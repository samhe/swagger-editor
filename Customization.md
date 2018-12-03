# Customization for swagger-editr

## Alow to apply the api spec actions for swagger file publish


* the apiSpecId to load when the page initialized
* the action of async methods:
  * getAPISpecList
  * getAPISpecById
  * uploadAPISpec

* APISepc schema:
  * API Spec List
  ```json
    [{
      "id": 1,
      "name": "GVVMC",
      "leadingInfo": [
        "[GET]/openapi/gvvmc/eta",
        "[GET]/openapi/gvvmc/etb"
      ]
    }]
  ```
  * API Spec Object
  ```json
    {
      "id": 1,
      "name": "GVVMC",
      "spec": {
        //swagger json
      }
    }
  ```
* Sample Codes
  ```javascript
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
  ```

## Allow to set the default value of api_key

* security definition

```json
securityDefinitions:
  csAppKey:
    type: apiKey
    name: appKey
    in: header
```

* set the default value of target definition

```javascript
var schema = editor.specSelectors.securityDefinitions().get('csAppKey');
editor.authActions.authorize({csAppKey: {name: "appKey", value: "xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxxxx", schema}})
```
