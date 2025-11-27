const DEFAULT_BRANCH = "master";

const sanitizeLocationValue = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }
    return value.trim().replace(/\/+$/, "");
};

const buildRawGitHubUrl = (owner, repo, branch, pathSegments) => {
    const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
    if (!pathSegments || pathSegments.length === 0) {
        return base;
    }
    return `${base}/${pathSegments.join("/")}`;
};

const normaliseGitHubLocation = (url, defaultBranch) => {
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length < 2) {
        return url.href;
    }

    const [owner, repo, ...rest] = pathSegments;
    const branchFromEnv = sanitizeLocationValue(defaultBranch);
    const fallbackBranch = branchFromEnv || DEFAULT_BRANCH;

    if (rest.length === 0) {
        return buildRawGitHubUrl(owner, repo, fallbackBranch);
    }

    const [specifier, ...remaining] = rest;

    if (specifier === "tree" || specifier === "blob") {
        const branch = remaining.shift() || fallbackBranch;
        return buildRawGitHubUrl(owner, repo, branch, remaining);
    }

    // Remaining path is relative to the fallback/default branch
    return buildRawGitHubUrl(owner, repo, fallbackBranch, rest);
};

const normaliseRawGitHubUrl = (url, defaultBranch) => {
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (pathSegments.length < 2) {
        return url.href;
    }

    const [owner, repo, ...rest] = pathSegments;
    const branchFromEnv = sanitizeLocationValue(defaultBranch);
    const fallbackBranch = branchFromEnv || DEFAULT_BRANCH;

    if (rest.length === 0) {
        return buildRawGitHubUrl(owner, repo, fallbackBranch);
    }

    const [specifier, ...remaining] = rest;

    // If the path already has /tree/ or /blob/, extract the branch and remaining path
    if (specifier === "tree" || specifier === "blob") {
        const branch = remaining.shift() || fallbackBranch;
        return buildRawGitHubUrl(owner, repo, branch, remaining);
    }

    // If no tree/blob specifier, assume the first segment is the branch
    const branch = rest[0] || fallbackBranch;
    const pathAfterBranch = rest.slice(1);
    return buildRawGitHubUrl(owner, repo, branch, pathAfterBranch);
};

const resolveResourceLocation = ({
    value,
    envName,
    defaultBranchEnvValue,
}) => {
    const sanitised = sanitizeLocationValue(value);
    if (!sanitised) {
        throw new Error(`${envName} environment variable is required.`);
    }

    if (!sanitised.startsWith("http")) {
        return {
            basePath: sanitised,
            loadFromLocalFile: true,
        };
    }

    let basePath = sanitised;

    try {
        const url = new URL(sanitised);
        if (url.hostname === "github.com") {
            basePath = normaliseGitHubLocation(url, defaultBranchEnvValue);
        } else if (url.hostname === "raw.githubusercontent.com") {
            basePath = normaliseRawGitHubUrl(url, defaultBranchEnvValue);
        }
    } catch (error) {
        // If URL parsing fails, fall back to the raw string; downstream calls will surface issues.
        basePath = sanitised;
    }

    return {
        basePath,
        loadFromLocalFile: false,
    };
};

module.exports = {
    resolveResourceLocation,
};

