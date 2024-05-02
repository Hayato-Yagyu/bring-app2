import * as React from 'react';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';
import { collection,  deleteDoc,  doc,  getDocs } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import {db} from '../firebase'
import Button from '@mui/material/Button';
import { Menu } from '../components/Menu';
import { Typography } from '@mui/material';


const rows:any = [];
const columns = [
  { field: 'id', headerName: 'ID', width: 90 },
  {
    field: 'applicant',
    headerName: '申請者.',
    width: 150,
    editable: true,
  },
  {
    field: 'classification',
    headerName: '持込・持出区分',
    width: 150,
    editable: true,
  },
  {
    field: 'period',
    headerName: '持込・持出日',
    width: 300,
    editable: true,
  },
  {
    field: 'where',
    headerName: '持込・持出先',
    width: 200,
    editable: true,
  },
  {
    field: 'materials',
    headerName: 'データまたは資料名',
    width: 400,
    editable: true,
  },
  {
    field: 'media',
    headerName: '媒体・PC',
    width: 150,
    editable: true,
  },
  {
    field: 'permitdate',
    headerName: '許可日',
    width: 150,
    editable: true,
  },
  {
    field: 'permitstamp',
    headerName: '許可者印',
    width: 150,
    editable: true,
  },
  {
    field: 'confirmationdate',
    headerName: '持出返却 確認日',
    width: 150,
    editable: true,
  },
  {
    field: 'confirmationstamp',
    headerName: '確認者印',
    width: 150,
    editable: true,
  },
];





export const BringList = () => {
  const [posts, setPosts] = useState<any[]>([]);

    useEffect(() => {
      const usersCollectionRef = collection(db, 'posts');
      getDocs(usersCollectionRef).then((querySnapshot) => {
        return setPosts(
          querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
        );
        });
  }, []);

  
  let selRows = React.useRef([]);

   // 行の削除
   
    const delRows = () => { 
      /*console.log(selRows.current);
      if(selRows.current.length == 0) return;
      
      let newRows = rows.filter((v) => selRows.current.indexOf(v.id) === -1); 
      setPosts(newRows);*/
    }
    



  return (
    <>
    <Menu />
    <Box sx={{ height: '100%', width: 'auto'}}>
      <Typography variant='h4' align='center' borderBottom={'2px solid gray'}>媒体等持込持出一覧</Typography>
      <br />
      <DataGrid
        rows={posts}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 20,
            },
          },
        }}
        pageSizeOptions={[20]}
        checkboxSelection={true}
        disableRowSelectionOnClick={true}
        onCellClick={(newSelectionModel) => {
          // newSelectionModelには行のIDだけが入っている
          console.log(newSelectionModel);
          //deleteDoc(doc(db,"posts", newSelectionModel.id))
        }}
      />
      <br />
      <div className="App">
        <Button variant="contained" color='warning' onClick={delRows}>削除</Button> 
        <Button variant="contained" color='primary' onClick={delRows}>編集</Button> 
      </div>
    </Box>
    </>
  )
}
export default BringList;