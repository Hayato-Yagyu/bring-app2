import React, { useState } from 'react';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

const BringClass: React.FC = () => {
  const [isChecked, setIsChecked] = useState<boolean>(false);

  const handleCheckBoxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsChecked(event.target.checked);
  };

  return (
    <div>
      <FormControlLabel
        control={
          <Checkbox
            checked={isChecked}
            onChange={handleCheckBoxChange}
            color="primary"
          />
        }
        label="持出"
      />
      <p>Is checked: {isChecked ? 'Yes' : 'No'}</p>
    </div>
  );
};

export default BringClass;
