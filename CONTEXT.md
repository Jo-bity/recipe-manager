# r3-recipe-manager

This context describes the recipe-authoring domain for an API-centered MVP that creates, validates, imports, exports, and later dispatches robot automation recipes.

## Language

**Recipe**:
A named, ordered set of Steps intended for a robotic arm to execute against a battery-related task.
_Avoid_: Workflow, script, program

**Step**:
The public, technician-facing unit in a Recipe. A Step has a case-study type such as Take Image or Unscrewing and appears in the ordered Recipe sequence.
_Avoid_: Raw action, command, vendor call

**Step List**:
The ordered list of Steps in a Recipe. Its order communicates the intended robot procedure sequence and is the place where a Robotics Technician reviews, reorders, or removes Steps.
_Avoid_: Action list, script, workflow, command list

**Action**:
An atomic robot-intent element nested inside a Step. The MVP supports Take Image and Unscrewing Actions and enforces exactly one Action per Step with a matching type; future compound Steps may contain multiple Actions.
_Avoid_: Public recipe unit, task, raw robot call

**Step Type**:
The case-study operation category of a Step, currently `take_image` or `unscrewing`. In the MVP the Step type must match the nested Action type.
_Avoid_: UI label only, command name

**Recipe JSON**:
The canonical, vendor-neutral representation of a Recipe used for download, import, validation, and translation into robot-specific API calls. It contains ordered `steps`; each MVP Step contains one matching atomic Action under `actions`.
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
The technician-facing view for adapting Recipe intent: naming Recipes, drafting and adding configured Steps, ordering Steps, configuring existing Step Action parameters, validating structure, and importing or exporting Recipe JSON.
_Avoid_: Admin UI, robot debugger, execution console

**Setup**:
The Recipe Editor area for defining the Recipe's operational purpose before adding Steps, such as the Recipe name and future Battery Layout or Process Constraint context.
_Avoid_: Metadata form, project settings, robot setup

**Step Configuration**:
The Recipe Editor area for selecting a Step type, configuring a draft Step before adding it, and editing an existing Step's Action parameters in technician language. Step-type selection alone does not mutate the Recipe; the draft enters the Step List only after Add configured step. Take Image configuration distinguishes full-battery image capture from battery section image capture and includes image output. Unscrewing configuration distinguishes automatic unscrewing from specific unscrewing. XY coordinates can be edited with number inputs or by selecting the preview image when a section or specific target is active.
_Avoid_: Raw JSON editor, inline add form, robot command form

**Adapter Preview**:
The engineering-facing review view for inspecting how vendor-neutral Recipe JSON maps to vendor-specific command plans without executing robot movements.
_Avoid_: Execution page, technician editor, robot control panel

**Step Model**:
The public Recipe model: ordered Steps with a Step type and nested Actions. It satisfies the case-study Step language while keeping atomic Actions available for adapter translation and future compound Steps.
_Avoid_: Action-only model, command schema, vendor payload

**Action Model**:
The nested data model for atomic robot intent. It provides a stable envelope for identity and type while allowing each Action type, such as Take Image or Unscrewing, to define its own parameters.
_Avoid_: Public recipe sequence, Step List, vendor payload
