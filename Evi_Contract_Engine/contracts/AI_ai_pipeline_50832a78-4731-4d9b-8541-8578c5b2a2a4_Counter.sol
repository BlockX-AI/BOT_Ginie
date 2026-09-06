pragma solidity ^0.8.0;

/**
 * @title Counter
 * @dev A simple contract that allows incrementing, decrementing, and viewing a counter.
 */
contract Counter {
    uint256 private _value;

    /**
     * @dev Emitted when the counter is incremented.
     * @param currentValue The new value of the counter.
     */
    event Incremented(uint256 currentValue);

    /**
     * @dev Emitted when the counter is decremented.
     * @param currentValue The new value of the counter.
     */
    event Decremented(uint256 currentValue);


    /**
     * @dev Initializes the counter to zero.
     */
    constructor() {
        _value = 0;
    }

    /**
     * @dev Returns the current value of the counter.
     */
    function current() public view returns (uint256) {
        return _value;
    }

    /**
     * @dev Increments the counter by 1.
     */
    function increment() public {
        unchecked {
            _value++;
        }
        emit Incremented(_value);
    }

    /**
     * @dev Decrements the counter by 1.  Reverts if the counter is already at 0.
     */
    function decrement() public {
        require(_value > 0, "Counter: value must be positive");
        unchecked {
            _value--;
        }
        emit Decremented(_value);
    }
}
