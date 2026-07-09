# Use Action Model as Canonical Recipe Language

The product should use Action and Action List as the canonical language for recipe authoring instead of Step. This better matches how Robotics Technicians think about procedures, and it gives the API a general Action Model that can support Take Image, Unscrewing, and future action types without leaking vendor-specific commands into Recipe JSON.
Recipe JSON should optimize for human-readable procedure intent before adapter convenience. Robot Adapters may do transformation work, but vendor-specific command fields should not leak into the Recipe authoring model.
Validation is split into two levels: the shared Action envelope validates identity, type, parameters presence, and ordering within the Action List; each Action type validates its own parameter schema. This keeps the Recipe machinery stable while allowing new Action types to be added with focused parameter rules.
