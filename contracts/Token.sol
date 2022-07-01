//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "./interfaces/IERC20MintableBurnable.sol";

contract Token is IERC20MintableBurnable, ERC20PresetMinterPauser {
    uint8 private _decimalNum;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalNum
    ) ERC20PresetMinterPauser(name, symbol) {
        _decimalNum = decimalNum;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimalNum;
    }

    function mint(address to, uint256 amount)
        public
        virtual
        override(IERC20MintableBurnable, ERC20PresetMinterPauser)
    {
        super.mint(to, amount);
    }

    function burn(uint256 amount)
        public
        virtual
        override(IERC20MintableBurnable, ERC20Burnable)
    {
        super.burn(amount);
    }
}
