# Use Conventional HTTP Error Categories

The API will use standard 4xx status codes to communicate error categories: 400 for malformed requests, 404 for missing resources, 409 for ordering conflicts, and 422 for domain validation failures. Response bodies may include a small code such as `invalid_recipe`, `invalid_step`, or `unsupported_vendor`, but field-level messages carry the technician-facing detail.
