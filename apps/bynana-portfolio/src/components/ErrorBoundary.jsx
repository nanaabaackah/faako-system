import React from 'react';
import ErrorPage from '../pages/Error';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error('App error boundary caught:', error, info);
  }

  resetError = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      return <ErrorPage error={error} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
