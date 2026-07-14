const API_VERSION = 'v1';
const SUPPORTED_VERSIONS = ['v1'];
const DEPRECATED_VERSIONS = [];

function versionMiddleware(req, res, next) {
  const acceptHeader = req.headers.accept || '';
  const versionMatch = acceptHeader.match(/application\/vnd\.clinicflow\.([a-z0-9]+)\+json/);
  const requestedVersion = versionMatch ? versionMatch[1] : API_VERSION;

  if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
    return res.status(400).json({
      error: 'UNSUPPORTED_API_VERSION',
      message: `API version '${requestedVersion}' is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
      supportedVersions: SUPPORTED_VERSIONS,
    });
  }

  if (DEPRECATED_VERSIONS.includes(requestedVersion)) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString());
    res.setHeader('Link', `<${req.protocol}://${req.get('host')}/api/${API_VERSION}${req.path}>; rel="successor-version"`);
  }

  req.apiVersion = requestedVersion;
  res.setHeader('API-Version', requestedVersion);
  res.setHeader('API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));

  next();
}

function routeVersion(version) {
  return (req, res, next) => {
    if (req.apiVersion !== version && !DEPRECATED_VERSIONS.includes(req.apiVersion)) {
      return res.status(404).json({
        error: 'VERSION_MISMATCH',
        message: `This endpoint requires API version ${version}`,
      });
    }
    next();
  };
}

module.exports = {
  API_VERSION,
  SUPPORTED_VERSIONS,
  versionMiddleware,
  routeVersion,
};