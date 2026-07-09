# r3-recipe-manager

This context describes the recipe-authoring domain for an API-centered MVP that creates, validates, imports, exports, and later dispatches robot automation recipes.

## Language

**Recipe**:
A named, ordered set of automation instructions intended for a robotic arm to execute against a battery-related task.
_Avoid_: Workflow, script, program

**Step**:
One instruction inside a Recipe. The MVP supports Take Image and Unscrewing steps, each with type-specific properties.
_Avoid_: Action, task, command

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
Planned follow-up functionality intentionally excluded from the 6-hour MVP but worth discussing to show product and engineering judgment.
_Avoid_: Backlog, missing work, future ideas

**Robotics Technician**:
The primary user of r3-recipe-manager. A Robotics Technician configures and adjusts robot recipes for operational work but should not need to understand vendor-specific robot APIs.
_Avoid_: Robotics expert, developer, automation engineer
