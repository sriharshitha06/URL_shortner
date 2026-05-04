# Code Review: Add user summary generation

## Decision
I’m using a summary review for this PR so the main themes are clear up front and the feedback feels easier to act on. I’ll call out one required bug fix first, then separate readability suggestions from style preferences.

## Strengths
The function is nicely self-contained: it takes input, computes a result, and returns it without side effects. That makes it easier to test and reason about. I also like that the PR is solving a clear business need by summarizing active/inactive users and account age in one place.

## Required Changes (Bugs)
There is one correctness issue that needs to be addressed before merge: `average_account_age = total_age / cnt` will raise a `ZeroDivisionError` when there are zero active users. What should the function return in that case? I’d suggest adding an explicit guard, for example handling `cnt == 0` with a safe default or a clearly defined return value so the function does not crash in production.

## Suggestions (Readability / Style)
A few readability changes would make this much easier to maintain. Could we rename `d` to something like `summary`, `cnt` to `active_count`, and `cnt2` to `inactive_count`? That would make the intent much clearer for the next person reading this.

The loop would also be easier to follow if it iterated directly over `users` instead of using `for i in range(len(users))`, since the index is not used for anything except lookup. Would you consider switching to `for user in users`?

The nested `if/else` block for `health` is capturing useful business logic, but it is a little hard to scan in its current form. It may read more clearly if extracted into a small helper function or rewritten in a flatter way so the conditions are easier to follow.

One thing I would treat as a style preference rather than a required change: building the result as a dictionary is acceptable for a small internal tool. If we expect this structure to grow, a dataclass or dedicated object could make it more explicit, but I do not think that is necessary for this PR.

## Final Verdict
Not ready to merge yet because of the divide-by-zero bug when there are no active users. Once that is fixed, I’d be comfortable with this direction, and the readability improvements would make the code easier to maintain over time.
