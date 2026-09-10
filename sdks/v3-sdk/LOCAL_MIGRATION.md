# Compatibility package maintained with the public Ring SDKs

The business-source baseline for this package is `Few-Protocol/ring-sdks@902db0dad9d4fb797907f73b7d8be3c467354485`. Its local candidate version is `1.0.0`, changed from the source version `0.1.11`. This candidate has not been published.

SDK imports follow the public Ring package roles: `sdk-core` for shared types, `v2-sdk` for FewToken v2, and `uniswap-v2-sdk` for ordinary Uniswap V2. Workspace dependencies, build output and module entries are package migration changes, separate from Robinhood network IDs and deployment mappings.

The general mixed-route #706 and canonical wrapping helper changes from the earlier local candidate have been withdrawn. The current candidate retains the baseline business algorithms; earlier tests of those broader changes do not validate this candidate.

The source LICENSE is preserved. Existing ABI files, where present, match the frozen source. See the root README for current Robinhood mappings and the limits of the network configuration checks.
