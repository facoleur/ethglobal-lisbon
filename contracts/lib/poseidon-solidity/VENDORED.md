# Vendored, not a submodule

`poseidon-solidity`'s GitHub repo (`vimwitch/poseidon-solidity`, later renamed
`chancehudson/poseidon-solidity`) is gone — both return 404/401 as of this writing. The package
is still published on npm, so these `.sol` files are extracted directly from the
`poseidon-solidity@0.0.5` npm tarball (the version `@zk-kit/lean-imt.sol@2.0.0` — itself vendored
as a submodule at `contracts/lib/zk-kit.solidity` — depends on), rather than added as a git
submodule like the rest of `lib/`.

Source: https://registry.npmjs.org/poseidon-solidity/-/poseidon-solidity-0.0.5.tgz
