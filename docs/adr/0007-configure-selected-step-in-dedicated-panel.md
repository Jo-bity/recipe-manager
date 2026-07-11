# Configure Selected Step in Dedicated Panel

Steps should be added through Add Step and configured through a dedicated selected-step panel instead of a large inline add form. The MVP presents Take Image and Unscrewing as Step types backed by one atomic Action per Step.

Step Configuration owns parameters that tune the selected Step after it exists: image area, section center, unscrewing mode, and screw target coordinates. Take Image distinguishes full-battery image capture from battery section image capture. Unscrewing distinguishes automatic unscrewing from specific unscrewing. Point cloud output is configured in Add Step because it is part of the image input/output selected when creating a Take Image Step. Coordinates can be edited through numeric fields or by selecting the preview image when the active mode has an XY point. Image source and tool profile remain disabled outlook fields until the model supports them.

The tradeoff is slightly more UI state, but the result is easier for a non-expert technician to understand and extend with future compound Steps.
