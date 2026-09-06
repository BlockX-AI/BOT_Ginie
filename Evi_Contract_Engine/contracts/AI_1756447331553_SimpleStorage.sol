// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract SimpleStorage{uint256 private v; function set(uint256 x) external {v=x;} function get() external view returns(uint256){return v;}}