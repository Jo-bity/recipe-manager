# Configure Selected Step in Dedicated Panel

Steps should be drafted and configured through a dedicated Step Configuration panel instead of being immediately added from a Step type picker. The MVP presents Take Image and Unscrewing as Step types backed by one atomic Action per Step.

Step Configuration owns parameters that tune either the draft Step before it is added or an existing selected Step after it exists: image area, image output, section center, unscrewing mode, and screw target coordinates. Take Image distinguishes full-battery image capture from battery section image capture. Unscrewing distinguishes automatic unscrewing from specific unscrewing. Coordinates can be edited through numeric fields or by selecting the preview image when the active mode has an XY point. Image source and tool profile remain disabled outlook fields until the model supports them.

The tradeoff is slightly more UI state because the editor keeps a draft Action before persistence, but the result is easier for a non-expert technician to understand and extend with future compound Steps.
