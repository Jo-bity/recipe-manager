# Use Action-Level Recipe Endpoints

The API exposes Actions as nested resources under a Recipe instead of only accepting full Recipe replacement. This matches the Robotics Technician workflow: add an action, edit its parameters, move it, remove it, and validate the result. The tradeoff is that the backend must own ordering and recipe-wide validation invariants, but the API better represents the core technician actions and keeps the UI thin.
