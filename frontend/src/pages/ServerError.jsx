export default function ServerError({ error }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-8">
            <h1 className="text-4xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-6">An unexpected error occurred. Please refresh the page or try again later.</p>
            {error?.message && (
                <pre className="text-sm text-gray-400 bg-gray-100 rounded p-4 max-w-lg overflow-auto">
                    {error.message}
                </pre>
            )}
            <button
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                Refresh
            </button>
        </div>
    );
}
