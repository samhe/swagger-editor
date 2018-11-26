import React, { Component } from "react"
import PropTypes from "prop-types"

class CSAPIInfo extends Component {
  static propTypes = {
    onSelect: PropTypes.func.isRequired,
    apiSpec: PropTypes.object.isRequired
  }
  constructor(props, context) {
    super(props, context)
    this.state = {
      collapsed: true
    }
    this.apiSpec = this.props.apiSpec
  }
  getLeadingInfoStyle = () => {
    return {"display": this.state.collapsed ? "none" : ""}
  }
  render() {
    return (
    <ul>
      <li><button type="button" onClick={() => this.setState({collapsed: !this.state.collapsed})}>{this.state.collapsed ? "+" : "-"}</button> {this.apiSpec.name} <button type="button" onClick={() => this.props.onSelect(this.apiSpec)}>Select</button>
        <ul style={ this.getLeadingInfoStyle()} >{this.apiSpec.leadingInfo && this.apiSpec.leadingInfo.map(apiInfo => <li>{apiInfo}</li>)}</ul>
      </li>
    </ul>
    )
  }
}
 
export default CSAPIInfo