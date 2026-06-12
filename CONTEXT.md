# Alcohol Label Verification

This context describes the language used to compare submitted alcohol application data with label artwork.

## Language

**Verification field**:
One of the seven label attributes represented by the tool. A verification field may be applicable or not applicable to a specific product.
_Avoid_: Required field

**Applicable field**:
A verification field that the submitted beverage type and application say is required for the product and must therefore be compared with the label. The government warning is always applicable.

**Not-applicable verdict**:
A neutral result for a non-warning verification field that the submitted application says does not apply to the product.
_Avoid_: Pass, match, skipped

**Canonical government warning**:
The authoritative warning text against which both label artwork and submitted application text are checked. Matching-but-incorrect values cannot pass.
_Avoid_: Submitted warning

**Batch job**:
A submitted collection of label applications that continues verification independently of an agent's browser session and retains progress and results for a limited period.
_Avoid_: Browser queue, upload session

**Job link**:
An unguessable, temporary URL whose possession grants access to a batch job while that job is retained.
_Avoid_: Account history, login token
