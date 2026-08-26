export default class ImageTextures {
  constructor(gl) {
    this.gl = gl;

    this.anisoExt =
      this.gl.getExtension("EXT_texture_filter_anisotropic") ||
      this.gl.getExtension("MOZ_EXT_texture_filter_anisotropic") ||
      this.gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");

    this.samplers = {};
    // names ever attempted; blocks duplicate in-flight loads and retry storms
    this.attempted = new Set();

     
    this.clouds2Image = new Image();
    this.clouds2Image.onload = () => {
      this.samplers.clouds2 = this.gl.createTexture();
      this.bindTexture(this.samplers.clouds2, this.clouds2Image, 128, 128);
    };
    this.clouds2Image.src =
      "data:image/jpeg;base64,/9j/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCACAAIADASIAAhEBAxEB/8QAHgAAAgMBAAMBAQAAAAAAAAAABgcEBQgDAQIJAAr/xAA3EAABAwMDAwIFAwIGAgMAAAABAgMEBQYRABIhBzFBE1EIIjJhcRSBkRWhI0JSscHRFvEXgqL/xAAbAQACAgMBAAAAAAAAAAAAAAAFBgMEAQIHAP/EADERAAIBAwMDAgUDAwUAAAAAAAECAwAEEQUSITFBURNxImGBkcGh0eEGFPAVIzJysf/aAAwDAQACEQMRAD8AzRGpiQkfL/bU+HSd2cJ/tq0h0rc2lQbzq0g0oZwU6bw2KWyAarItECkZ9PkDtrsKSUEAo0RRKUfA/tro9SyF42/21sH5rTbxQ6mlhPy7B312RTQf8urlVO+blI4+2ujcDHzBH41ndxWtH/wwdJrSuyqSLpvCoFMakPtKZhNhKjJczkBQP+TIGfydati9YJVMbD7SG24rTaVvNBIG8EjvjxrFlo1KoUWcv9E6pIdThYB+/Gmii85tItvEp5S3XWMJPsBnSR/UGnyXd0C7ZHYePNNmjXkcFsQowR1PmgP4qLHsf/5LcrHT5zfEqQDspjPzNSFKO/8A+pPI0vLk6cT7YQiS98riUhShjsD2OdMGr0u4J1N/r66O4uEF5MgN52qHPOha4Z1RqqUJdUr0yOUFWc8nB0es5JookjL5C8Enr7UHu1ieR3C8nkUv6tAR6i3PTSCo8gedD8+nBJJI/to9qlJQ0Vn6yUkBIHY6qkWyipFTCXtrgTuSkp4J9tElvbdTgtQ42k7DIWgSoQQlrdtwPONUFRpwWokN5/Ojuu0xlooEdW7IO4Y5Bz51RTYiUoKSMnPA0QQ8VUYY4oJlQAD9ONQnGltq3IGCPbRPNp+TwnnVZKgFJICdbkA1F3xWmaZSFDLKm9pB5HtqxjUspX9IPPto9q1r0WbW478V2OxFdeLbspncc5Jwog/YZ4HvqFPtddPlraC0uISspQ4gcKHv/toJFcrIAfNGpIWQkGqOJTApOdvI10cpCid238avI1KKQAU99Sl0kZ+jUu7FRY4oTVTPmOU9uM69RTyFbduiN2lKBJAPftrgqmlLgynUobNaEDNG1b6TwLYs2g1CiylSFVGGmXMU60EqZeIwUDzhP+5OqytUFFNtdz1JiVS3lhuM00oKH3/B7fzqddt/Vm44zaqjICgyyltIQkJACQB2HHjQvGqa1TW1vpyhKxu58Z5xpcht7yXLyHJBz/H+Cjcs9tEAsY6j+K5RavfCqGbOabcZirkEOJGQSvzz7Y8dtVNzW6KURDISpYHzkHsfbWgIXSt7qH0+/wDKOnlIdjwRJV6jsp9GxSk/VyTkEbh3HIOgSp9EbwclFMqiPqcW2VpwnIUkHGcjjGcc6rPexOSMBcHkd8/Op0tHRQclsjg9sfKlC3brjjnyMFXGTgarqmhFFfbdRDAUM9x408+nPTqVImy5dWihiLDHpSHpHyp3KBwAfJ4/bSv6nw6YqrvR6dylskAkd/vqu10rXHpeBUogIi3+aU1ZhIXJdWjkKJPHvodm01QWSRg/fRwGJ0GSsQmElx0bdy0BQGfsde1wW409FaS1ESjanBcCeVH76ZrPVVLhH70AutPYKWWljKgHJ488arJUMAcftoxq9GciOlh5rCsfzqml07uCn8Y8aYAQwzQQ7lNbdh1CkXh0ltMqgeg/TRIYfkNIyFr3BQQv24JIV9yPGpdZkOVC3Y9IFHisNsyFuoWyg7iSAnkkn/SNHPwZ9D4t8XC9aNYkpj+nISs+qnI2j5Twe/BI/fQ/XraetytTrckn1DElOM7gMAlKiM/vjXO9KvIbgekhyyc/cmnjULd4W3t0YY+wFCTFHPHya7uUtPp/RyPfRHDpBcTuUnGPYa9pNISGz8vj20wl91BANpoNcpu4H5edR5NKwncGzopVS1JJBRrwuklRJCPyDqwJAKgZTQW5CUEEJzg8aiu0xSDyjRk7RWUuHfgADJzr1NnT6hDemwIbrjMcD1nW2yUoz2yfGsPcRRDJOBXkjkkOFGajWP1duiy6Y9akeQo0+SvLoT9aCSnJSSePpGtg2S1YHUTpW1Q7SiCPcKIbCng8RvDJ/wA+ASNp2jz3VrMXTnp50puddStu5LpXAqpYCqVKcUPRUsD6VewPvqL06vi8OiHVBiXElpkLhueg421K3NPNk/SFDjb5/wCNK2p2tprAdbY7ZV+Lxu/cdv8A2mCzuLnTNpnGY2484p49X+j1zRLXw7SGI7bPPpxE49RRGN6s9ycDWSbxsOeuruJ9BW4k7uNfSK3eqNq9fKGlpyImK/JipU9HV3bXkggKxgjAGP8AjSqvHobZdrTHJdS2PPkqUhpI7DnBP/Wka21C5tJmimX4h2poltYbiNXQ8VhhzplPbZD8iKUjOUk6hihwUyBHmtlSQeRrRV8wqG/NdgJCG1I4AAxxoFqPTmO0n9Y642A4SUKUccaZLW4nY5cYoNPDEowvNZ26j0int1o/08KKfSG8K7BXsNB82nhPJT302r/ttlqorLBC1Endg8Y0EVSkBsfKj8nXTLCQNaoM9qQ7xCtyx+dfXbp50Yj2X14g3PDqMVFNcfCHVMujasKyAcd8EjOgf4zbBtmmdX3ZVuS21idEbceaQMlteNuSexyADpo2MazfMqk2/VKBGpyl09IfnsvJU68RnCknGUZ9j586VnVylSmL6qNOefflOxHy0iTIjltxwJ7KUk58eexHOuRf08mLondyBg48e9dJ1dswKNvGf19qVVPtiTCa2SFZPca4OsQ5C1sMPJUtJ+ZAPI0aOzbYgMKRdElTRCvmCEHcBqvbteiJjs1qjvJdalp3tuDByP8Ag/Y6b4boBhGpBA680vy2+4F2GCflQkunOR1B5CfnScgkdjrnSaRMmvOsxoq3Htu5v005xjkkj21e3TNhUZMNLjjKhLkFn5HklSFDHdI5HcajOB6ivKkeqGfTBDpUcYHkHVwXCSKdh5qmbd43BYcUob7n1+mVkLkvOEpWSWkjjGfbTM6c/EVZlJsuXaNdtFLjTyQUspJRuXgAkkd8gdvvpZdReq1uvVmSiLR0yFFBQw+66RsXn6sDuO/GrazbchXlaEeqPOID3qLQtTRAyQeD20Int1v19NjxnPWikU39kd4FVFyUR+fcblUoEcxmXF7kNgnCAfA11hwpTDiHZSypQOcnxz30ZNW25DhJafXuWgbc48DtqpqTTMbKU4z7jxo1Z2aRgeRQi6u3kJGOKPh18kWLaMGgWOACzJbeckqXlYUkDcDx9JwCPYZGukz4mpF1rdkXKp9tx1JKw2gKSV8DI8+/86Uclkqc3DzqZToIS2h2S0otlWAoDWJND09huZMse/fmsLq16DgNx47VY1qoKqtRXVVFam1ghsg4UDjzoSuip1d1aFSXVhtAIQB5GjSVEK6W3FS0gFZ3eojlR7jGha56dLaSr9QSVIGCDqS3ihU7QOnFRTTSkZJ680C1ebFdWoFo8/5j30I1WEhS1FsceM6K6rAcLp+XAOqiRBJB+3nRiGNYh8NDZHaQ81rywfilva169DqTdceebW16U0LbG5KDgEJKgcEAcHnHGnR03609MKxc9Sua7rlnznJdNMeLNkspU7HXtCQpfjhIKQRz9hrL1RtGown1MOwiCg4ykasOnsio2/XG3THDzSnNrzLo4UnPY64uk8Ppsq4XcMEjxXUmjcspPODmj7rf1jtaE5LsxujxZrpfC2KwwTuUjByFbuVFXH4PbvpdRr7qdPpS0W9L/wAPBDbbxJDZPJ2jRHeHTZdSdfrTcdKFOLK0tDsM+BnxpbTKNVYEwxn1qShKs8DvqK1vFiAEbYIreaAvneuQaGqiKqqUqa5JXu9XKypR4OdH3VXrxat9WXT7fjW8qFPj09uPUZaFDbLWgk+qQAMKOeT9hodfpUp7ewpkuZyUnGq1FrLU4W3IhVjk/L2GiCalnBY8j81VazBOAOKBK3SxNbWpleSTkH2OqamXjdtkqdZpFXeZS6MLShfB044dhwX2khCASQcj20P3J0YS80uXEyTkkpUO2trbWBFJgmsTaeZEyBQ9a3xB3pEnJbqE4ymlLHqNv8kJ84PjTYp06j3W2t+hTfXCQPUSRhSSecEaTVv9Np02vNUhmKS668EJG3yTjWqOn/wt1Lpz08XeUp9S3n3UJVG9PkdyD/GmO21tI50Qt/y4oHcaX6kTMB0pdv0R9tzYtkg+xGrmkWtUZVGkS48UuIjAKe2HkAnGceQD/GdGlcoNEYDb0mcWn1n6HUgc444/j8a80SuN2hV/0cKvQnHKiyppTTL4USSCnCk+4+/fRhtWSSL4SN3j2oWNMdZPizt80vo7r7TgabwnKhyQDjVfd9QlT/kdhoVlWN6EY2/xp+dUehE9FIp9YtC1B6JiIMltkb1heDyR9Qz3JPuMccaUt2UetWZXXYteoDbZ2lPpuJyk/ca1t72C9AaEjd4yM8ViW0msziUHb9cUpaxS20qJIOTqlkQUlw7iB+dHVSplQqzizDhKc/Ce2qGvWdcNFWn+rUWSwXAPTS4yRuzyP/Wj0cgwFY80IZCTkDivpX8VPw801VzNnpxZH+A+guPuxWysbvOTnA/AGk1B+Hq42ni6zRnErCsKQWz/AG1rTolecyp1RtNEqbclKzhaUvBQP2Izxp1t0K3ayEznKS2l0EE7m8EEe/vrii6JNds3oSAc9COMfIg/piuof6ikCqJEJ4655rArvTCfGo6WajS1pLacKCk6Xt02bQ2Za1CPtXtyQpvjOvpndXTe1brgqjz6U1vDZDa0JAIOOO2ss9behX9BTIeapayo52YT5xoRqmmXukSAy/ErdCPz4q/Z31vfKQBgjsfxWRW6ZAdqCkOQW21NqwFK4Sv7asY9qWvKkKfrTzMNYSEsjBKXeexxnB5z7YGpN4dP7imz/wBJHiOghR+lBGDqnn9JbzXG9V2Q6FpO5CVK5zra3kh4LEV51cjgV6XeuybLfMSnRzLX6gCi2PlUPJSod/zrlHtqFcUYz6QM7+Sw59bf2PvrpRentcvWGbafaWioMOYZcKSfVznj851P6e9Lb6oFzvCtxH2RDBQU4IC14JAx+3bRIvYTNsOFqqBcxruXJrnZPQeDVr5iJnKERpbgU5KCeEpyOfzrZzHTtq3WYFSrdZjSYLbCREUED05GAkbccjtkknk7tZ6pN0xE1eHSlRUxlLcKZBkLCUpxzwo8aeNUvWpVm1lWNbMiO1FYS3+plyXgG2Bzk7z/AKhwAM9vOpZbK1dUxJn8CoVubhWbKY/Jqo6ufD303uigu1aPCjRlNoUtTkZYIK+TjA5HGsd1LpTBX1FbjuTFIaaXuQ8T2xzjjWtrtjVSgUpTFAlTZDLkdKZT76QGlr5+jODj86S9Qt6XDqLzspsF0hW1QTnbnyP+9aWNvPFKRA5ZT0/NZuZ4njBlUA1E6o9TqzZttttWxdz63URiy8WnjyefPfQ70y6iUTqvVac51RgvvphtlpxsAkPKzgE+c+/416VG3FvuOpqSN5KspPfjXpb77VnuIdp8dGUOAqSU9x50xadp9wqbx1556Gg17fwFtpPHHHUU3qzbHRm3qYqu0mz2UkM+qpsRVEpB7eCBz/fSiuzrXZcZ5bbFCkuFRKX2nTgDHbH3B1ZXb1SrVTpK4kN1UcuK/wAXYo4UB2GPGlJXYpdU4p5AUpfO46LaZo+/LXZJP/Ymhl/qwjIW2AA9hX03tT4M6h0/u1FyWrcBejNSAttorw5tByOR5/fT7odPkU7LCqi883jKUyQSpP2ydQrWlszGyYs1DgQSFhOQQfwQD++r5skp5/vobpen2sR9eInn55H0+Xvmi15dTv8A7b9vlXnVXcdOE5TLaGoxUtRQr12d2Unvj2ONWmo9Riuy45RHe9NwcoXjsdFbqITQFcZqnE2yQGg+vfD904rEGQw1Q22X3jkPp4KT/wBaCWPg7t8VJMyqy2pbAzlnBTg/n+NNmPTKs1S3WqjUvVfJJbcSSCBjgajxpdTgRnA8zvUTwpS+ex0Cl0fSZGV2g2cduPuBxRBL68QFVkz7/jNZO6n9N3OlFxuSrftlt0tLJZkqbIHfvz3wP99VU/q8OV1e04MaovRy87IeSFlzAOMJPCc/+tan6n9MqX1EpKpzLYM1qOvYkk8kjgazlU/hcvB+pNsVakyG0uH5n9mUoTpRvtMazlKsmVPQgZ4/ijdteCdQQcEdRSPuWsWzdEkS/S9KU6oFxpDWEIVjwNEFr9Kb66iUQKoM+WpqMP8ACb9X5BjJ7HxydFb/AEho/S2vuVW87fly4rIJaS1HO13nAAV4/J0x6ExU3bGiG3ILlJYdAUlltSd2XAMhXnA/51m0UyP6cZ248/tWLiT003uM+1LW1qBdlzzmLXqctS/0yFKcDjoSlCUDKuefY/zqrvql1uLWHEUumzEMykBDTK0HKk44HA5HkfbTftnp5eFp3MqY/DjvgDLuUqWgpyM8jzq7661Om0u3/wBSiptRX1oKUqKkk78ZwPYjTDPqK2ZUqAwAx9e5oPDZvdA5JUk/p2FZnX0Kv+quIV/Qgyl0btz7yEhIz3Izn+2dV909AZVv0hyrVO44Q9J0IcQyFKCfck48Z8DQVf3WHqfa9yvPsV6WArhKFrUAU54x9jpd9T/iD6nXQwiPLrTu1CMem0dqf3A7/vqymp6m7KVZQPb96gbT7FQQwYn/ADxTFrVj0qnU52oSLrpbacH0m5r/AKSlAEYUMntjn9tJW7OqNmw5K4qq7CVsVtK21bkq/fQDc1y12dvXUpbq/l5UtwnS8r0Vta1rDoOeSO+jFrqcqE+o276YobcafCw+AY+tf0SR6EavGZjVhbyVsq3MSI7pbcT+47jV3RKCaLkRak+60r6kyV7jn3zr2iE+mASTgcZ1PaIKcAY1W060gwJMcjHPf+auzXEjkr28V7a/a/a/dtGaq14WAUkHUCY0CCcfnU1bqe2o0japJz7agnAMdZU4OapZT78XJbcI/GoEp6qSEEhLqge5wedXamI5US6O+QT9sarrvmXJFp6DasNEraoB9pTmFFHkD86BzP6UTOxOB2AyftRBMO4UcZ7ngfeq2mxXKq5JjyWvVDaASyvsfm54PfjVPcKI9PlLW9b7TmwDLXokemnvuSPHbvqZVqhWodLeVSmxFdcVuLriDuSAOAc/fOs+9Zr26qUW5k1Gql+NvbDYcjuK9NwZyFjnyMZ/GgNzfQrIoA58np96JRWshQ5NOuuVuBKtb+vR5cgtNK2lppQUpCs8Ej7cHHkHWMPi96w1i4aoICUONRYiNkXJwVnPzLUAAASfHjtrQFl3Jdv6d1l90uKcKVblskpdyP8A9aUPXq36zNnPtItyPLBQXELTE5CO3O3tz76GTXDx3AkI49+9WogjxlAeayzX74qsimIk1Nla20HYlxwZyM9tQqjatVqcFM2jwzIbcbCwppGcA++O2ji8IFzR7edtmr2Y0Ii1hxBKfnbA3AbfbkjP41RUS2er1gUmRdnTR2UiM8ypuY20UrUkc8FJB4Gc5x31cS5Mi8YB/Q1XaNY+pyKSt9UGqMpX6jBBAwoAaB5dDlOx1VJtlaUt8KbxnPHfWpOllRi9SHZ1udR7ejTJrjvqMzBhhzBGCkgYSQDyDjuTnxqgv/4dXaDVXJ1Dp04RlKKSktBwKHPYjv8Ax41KmpNGxjcc/pULWyt8a1//2Q==";

    this.emptyImage = new Image();
    this.emptyImage.onload = () => {
      this.samplers.empty = this.gl.createTexture();
      this.bindTexture(this.samplers.empty, this.emptyImage, 1, 1);
    };
    this.emptyImage.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";
     
  }

  bindTexture(texture, data, width, height) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      data
    );

    this.gl.generateMipmap(this.gl.TEXTURE_2D);

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.REPEAT
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.REPEAT
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR_MIPMAP_LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    if (this.anisoExt) {
      const max = this.gl.getParameter(
        this.anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT
      );
      this.gl.texParameterf(
        this.gl.TEXTURE_2D,
        this.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT,
        max
      );
    }
  }

  loadExtraImages(imageData) {
    Object.keys(imageData).forEach((imageName) => {
      const { data, width, height } = imageData[imageName];
      if (!this.attempted.has(imageName)) {
        this.attempted.add(imageName);
        const image = new Image();
        // remote images load tainted without this and texImage2D throws
        if (!data.startsWith("data:")) {
          image.crossOrigin = "anonymous";
        }
        image.onload = () => {
          const texture = this.gl.createTexture();
          try {
            this.bindTexture(texture, image, width, height);
            this.samplers[imageName] = texture;
          } catch (e) {
            this.gl.deleteTexture(texture);
            console.warn(`[butterchurn] texture ${imageName} rejected:`, e);
          }
        };
        image.onerror = () => {
          console.warn(`[butterchurn] texture ${imageName} failed to load`);
        };
        image.src = data;
      }
    });
  }

  getTexture(sampler) {
    const tex = this.samplers[sampler];
    if (tex) {
      return tex;
    }

    return this.samplers.clouds2;
  }
}
