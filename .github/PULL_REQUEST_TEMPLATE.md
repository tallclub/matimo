## Description
<!-- Brief description of changes -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Tool addition
- [ ] Tool modification

## Risk (tool additions and changes)
<!-- Risk level (low / medium / high / critical), requires_approval yes/no, and why -->

## Testing
- [ ] Tests added in both SDKs (or explain why the change is single-SDK)
- [ ] All tests passing
- [ ] TypeScript coverage floors hold (`pnpm test:coverage`)

## Checklist
- [ ] Code formatted (`pnpm format`)
- [ ] Linting passes (`pnpm lint` in `typescript/`; `make lint && make typecheck` in `python/`)
- [ ] Tests passing (`pnpm test` in `typescript/`; `make test` in `python/`)
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No hardcoded secrets
- [ ] Tool YAML validated with `pnpm validate-tools` (if applicable)
- [ ] Examples added or updated (if applicable)

## Related Issues
Closes #[issue number]
