import { Component } from 'react'
import ErrorPage from './ErrorPage.jsx'

const supportedStatuses = new Set([400, 401, 403, 404, 408, 410, 429, 500, 502, 503, 504])

class AppErrorBoundary extends Component {
  state = { statusCode: null }

  static getDerivedStateFromError(error) {
    const statusCode = Number(error?.status ?? error?.statusCode ?? error?.response?.status)
    return { statusCode: supportedStatuses.has(statusCode) ? statusCode : 500 }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo)
  }

  render() {
    if (this.state.statusCode !== null) return <ErrorPage statusCode={this.state.statusCode} />
    return this.props.children
  }
}

export default AppErrorBoundary