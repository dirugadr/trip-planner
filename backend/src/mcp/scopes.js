// OAuth scopes of the MCP server (Épica 12). Kept apart so the provider, the
// router and the tool registration agree on the exact strings.

// Read-only access (HU-12.2). Every connection has it.
export const MCP_SCOPE = 'mcp:read';

// Create/edit access (HU-12.3): create_activity, update_activity, create_expense,
// create_poi. Never implied by mcp:read, only issued when the traveler ticks it
// on the consent screen, and never covers deletion (there are no delete tools).
export const MCP_WRITE_SCOPE = 'mcp:write';

export const hasWriteScope = (scopes) => Array.isArray(scopes) && scopes.includes(MCP_WRITE_SCOPE);
