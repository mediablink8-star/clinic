import { Component } from 'react';
import ServerError from '../pages/ServerError';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', error, info);
    }

    render() {
        if (this.state.hasError) {
            return <ServerError error={this.state.error} />;
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
