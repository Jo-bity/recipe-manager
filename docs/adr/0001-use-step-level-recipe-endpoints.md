# Use Step-Level Recipe Endpoints

The API exposes Steps as nested resources under a Recipe instead of only accepting full Recipe replacement. This matches the Robotics Technician workflow from the case study: add a step, edit its action parameters, move it, remove it, and validate the result. Each MVP Step has a case-study type and exactly one matching atomic Action, so the backend must own ordering and recipe-wide validation invariants while keeping robot intent reusable for adapter translation.
