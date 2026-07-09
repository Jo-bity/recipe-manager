# r3-recipe-manager

This context describes the recipe-authoring domain for an API-centered MVP that creates, validates, imports, exports, and later dispatches robot automation recipes.

## Language

**Recipe**:
A named, ordered set of automation instructions intended for a robotic arm to execute against a battery-related task.
_Avoid_: Workflow, script, program

**Action**:
A technician-facing instruction inside a Recipe. The MVP supports Take Image and Unscrewing Actions, each with type-specific properties.
_Avoid_: Task, command, raw robot call

**Action List**:
The ordered list of Actions in a Recipe. Its order communicates the intended robot procedure sequence.
_Avoid_: Script, workflow, command list

**Recipe JSON**:
The canonical, vendor-neutral representation of a Recipe used for download, import, validation, and translation into robot-specific API calls.
_Avoid_: Export file, payload, document

**Robot Command API**:
The application-facing command contract for robot operations. It hides the differences between Company A and Company B robot APIs behind the same set of commands.
_Avoid_: Robot SDK, integration layer, adapter API

**Robot Adapter**:
A vendor-specific translator that maps Recipe JSON or Robot Command API calls into the concrete API calls required by one robot vendor.
_Avoid_: Plugin, driver, robot API

**Deployable MVP**:
The smallest version that is useful to stakeholders: persistent recipe CRUD, validation, Recipe JSON import/export, and a clear Robot Command API design, delivered with enough infrastructure to run and review.
_Avoid_: Prototype, demo, proof of concept

**Core Functionality**:
The functionality that proves the Recipe model and Robot Command API are useful: define valid recipes, persist them, validate them, and exchange them as Recipe JSON.
_Avoid_: Full feature set, complete assignment, nice-to-have

**Outlook**:
Planned follow-up functionality intentionally excluded from the MVP but worth discussing to show product and engineering judgment.
_Avoid_: Backlog, missing work, future ideas

**Robotics Technician**:
The primary user of r3-recipe-manager. A Robotics Technician configures and adjusts robot recipes for operational work but should not need to understand vendor-specific robot APIs.
_Avoid_: Robotics expert, developer, automation engineer

**Battery Layout**:
The physical arrangement of battery components that a Recipe must act on, including where images are captured and where screws or parts are expected.
_Avoid_: Battery type, geometry, image layout

**Process Constraint**:
An operational condition that changes how a Recipe should be authored or adapted, such as workspace setup, tooling, robot availability, safety rules, or customer-specific handling requirements.
_Avoid_: Environment, context, setup

**Operational Robustness**:
The degree to which a Recipe is likely to produce the intended physical robot outcome without missing targets, damaging parts, breaking sequence assumptions, or requiring fragile manual intervention.
_Avoid_: App robustness, error handling, production readiness

**Production Quality**:
The level of operational readiness needed before Recipes can safely influence real robot behavior, including execution safety, capability checks, auditability, observability, recovery behavior, and hardware failure handling.
_Avoid_: Polish, completeness, production-ready

**Recipe Editor**:
The technician-facing view for adapting Recipe intent: naming Recipes, editing ordered Actions, validating structure, and importing or exporting Recipe JSON.
_Avoid_: Admin UI, robot debugger, execution console

**Adapter Preview**:
The engineering-facing review view for inspecting how vendor-neutral Recipe JSON maps to vendor-specific command plans without executing robot movements.
_Avoid_: Execution page, technician editor, robot control panel

**Action Model**:
The shared data model for all Recipe Actions. It provides a stable envelope for identity and type while allowing each Action type, such as Take Image or Unscrewing, to define its own properties.
_Avoid_: Step model, command schema, vendor payload
